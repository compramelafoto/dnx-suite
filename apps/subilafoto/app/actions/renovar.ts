"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { vencimientoDelEnlace } from "@/lib/paquete/enlace";
import { sePuedeRenovar } from "@/lib/paquete/renovar";

/**
 * El cliente pide enlaces de descarga nuevos.
 *
 * El enlace vence a los siete días a propósito: uno eterno es una copia de las fotos de
 * una fiesta circulando para siempre por WhatsApp. Pero que venza sin forma de renovarlo
 * deja sin su material a alguien que pagó, y el panel ya le promete que puede pedir otros.
 *
 * Se renuevan **todas las partes juntas**: un paquete partido en tres con una parte que no
 * se puede bajar no sirve de nada.
 */
export async function renovarEnlaces(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/");

  const volver = (error: string) =>
    `/cliente/${token}?error=${encodeURIComponent(error)}`;

  const enlace = await prisma.subilafotoAccessLink.findUnique({
    where: { token },
    select: {
      kind: true,
      revokedAt: true,
      expiresAt: true,
      event: { select: { id: true, retentionUntil: true } },
    },
  });

  const ahora = new Date();
  const vigente =
    enlace &&
    enlace.kind === "CLIENT" &&
    !enlace.revokedAt &&
    (!enlace.expiresAt || enlace.expiresAt > ahora);

  // El `redirect` va afuera del bloque que decide: lanza una excepción de control y
  // adentro de un `try` se la comería el `catch`.
  let destino = `/cliente/${token}`;

  if (!vigente) {
    redirect("/");
  } else {
    const paquetes = await prisma.subilafotoPackage.findMany({
      where: { eventId: enlace.event.id },
      select: { id: true, status: true, tokenExpiresAt: true, regenerations: true },
    });

    const veredicto = sePuedeRenovar({
      paquetes,
      retentionUntil: enlace.event.retentionUntil,
      ahora,
    });

    if (!veredicto.sePuede) {
      destino = volver(veredicto.motivo);
    } else {
      const vence = vencimientoDelEnlace(ahora, enlace.event.retentionUntil);

      /*
        Cada parte estrena token. Renovar el vencimiento sin cambiar el token dejaría vivo
        el enlace viejo, que es justamente el que puede haber circulado de más.
      */
      await prisma.$transaction(
        paquetes
          .filter((p) => p.status === "READY")
          .map((p) =>
            prisma.subilafotoPackage.update({
              where: { id: p.id },
              data: {
                downloadToken: randomBytes(24).toString("base64url"),
                tokenExpiresAt: vence,
                regenerations: { increment: 1 },
              },
            }),
          ),
      );
    }
  }

  redirect(destino);
}
