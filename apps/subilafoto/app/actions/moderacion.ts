"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { hashDeIp } from "@/lib/consentimiento";
import { ipDelPedido } from "@/lib/consentimiento-db";
import {
  estadoResultante,
  validarRevision,
  type AccionDeRevision,
  type EstadoFoto,
} from "@/lib/moderacion/revision";

const ACCIONES_VALIDAS = new Set(["APROBAR", "BLOQUEAR", "OCULTAR", "RESTAURAR"]);

/**
 * El dueño del evento revisa una foto que decidió la máquina.
 *
 * Todo lo que pasa acá queda auditado: quién, qué, cuándo y por qué. No es
 * burocracia — es la única forma de responder si alguna vez alguien pregunta
 * cómo llegó una foto determinada a una pantalla.
 */
export async function revisarFoto(formData: FormData): Promise<void> {
  const eventoId = String(formData.get("eventoId") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  const accionCruda = String(formData.get("accion") ?? "");
  const motivo = String(formData.get("motivo") ?? "");

  const volverA = `/panel/eventos/${eventoId}/moderacion`;

  if (!eventoId || !mediaId || !ACCIONES_VALIDAS.has(accionCruda)) redirect(volverA);
  const accion = accionCruda as AccionDeRevision;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect(`/login?next=${encodeURIComponent(volverA)}`);

  // El filtro por dueño va en el where: una foto de un evento ajeno ni se trae.
  const foto = await prisma.subilafotoMedia.findFirst({
    where: { id: mediaId, eventId: eventoId, event: { sellerProfile: { userId: usuario.id } } },
    select: {
      id: true,
      status: true,
      moderation: {
        orderBy: { decidedAt: "desc" },
        take: 1,
        select: { id: true, topLabel: true },
      },
    },
  });
  if (!foto) redirect(volverA);

  const ultima = foto.moderation[0] ?? null;

  const veredicto = validarRevision({
    estado: foto.status as EstadoFoto,
    accion,
    motivo,
    motivoDeLaIa: ultima?.topLabel ?? null,
  });
  if (!veredicto.ok) {
    redirect(`${volverA}?error=${encodeURIComponent(veredicto.motivo ?? "No se pudo aplicar.")}`);
  }

  const resultado = estadoResultante(accion);
  const ipHash = hashDeIp(ipDelPedido(await headers()));

  await prisma.$transaction(async (tx) => {
    // La condición del estado la resuelve la base: si entre que se pintó la
    // pantalla y se apretó el botón la foto cambió, esto no pisa nada.
    const cambio = await tx.subilafotoMedia.updateMany({
      where: { id: foto.id, status: foto.status },
      data: {
        status: resultado.estado,
        publishedAt: resultado.publicar ? new Date() : null,
        ...(accion === "OCULTAR"
          ? { hiddenAt: new Date(), hiddenByUserId: usuario.id }
          : { hiddenAt: null, hiddenByUserId: null }),
      },
    });
    if (cambio.count === 0) return;

    if (ultima) {
      await tx.subilafotoModerationDecision.update({
        where: { id: ultima.id },
        data: {
          overriddenBy: usuario.id,
          overrideReason: motivo.trim() || null,
          overriddenAt: new Date(),
        },
      });
    }

    await tx.subilafotoAudit.create({
      data: {
        eventId: eventoId,
        actorUserId: usuario.id,
        actorKind: "SELLER",
        action: `MODERACION_${accion}`,
        targetType: "MEDIA",
        targetId: foto.id,
        metadata: {
          estadoAnterior: foto.status,
          estadoNuevo: resultado.estado,
          motivoDeLaIa: ultima?.topLabel ?? null,
          motivo: motivo.trim() || null,
        },
        ipHash,
      },
    });
  });

  revalidatePath(volverA);
  redirect(volverA);
}
