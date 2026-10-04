import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { revisarEnlace } from "@/lib/paquete/enlace";
import { DURACION, enlaceParaMirar } from "@/lib/moderacion/vista";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Baja una parte del paquete.
 *
 * No sirve el archivo: **manda al cliente directo a R2** con una firma corta. Pasar
 * gigabytes por una función serverless es pagar por mover bytes, arriesgarse al tope de
 * tiempo y perder la reanudación cuando la conexión se corta a mitad. Bajando de R2, si se
 * corta se retoma.
 *
 * Un enlace vencido no devuelve un error: devuelve un mensaje. Quien lo abre ya pagó.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const paquete = await prisma.subilafotoPackage.findUnique({
    where: { downloadToken: token },
    select: {
      id: true,
      status: true,
      storageKey: true,
      tokenExpiresAt: true,
      partIndex: true,
      partCount: true,
      event: { select: { code: true, retentionUntil: true } },
    },
  });

  const veredicto = revisarEnlace(
    paquete && {
      status: paquete.status,
      tokenExpiresAt: paquete.tokenExpiresAt,
      retentionUntil: paquete.event.retentionUntil,
      storageKey: paquete.storageKey,
    },
    new Date(),
  );

  if (!veredicto.sirve) {
    // 410 y no 404 cuando venció: le dice al navegador y a quien lea los registros que
    // esto existió y ya no está, que es distinto de un enlace inventado.
    return NextResponse.json(
      { error: veredicto.motivo },
      { status: veredicto.vencido ? 410 : 404 },
    );
  }

  const nombre = `${paquete!.event.code}-parte-${paquete!.partIndex}-de-${paquete!.partCount}.zip`;

  /*
    El nombre del archivo va **dentro** de lo que se firma.

    Antes se firmaba la dirección y después se le pegaba `&response-content-disposition`.
    SigV4 cubre los parámetros de la consulta, así que agregar uno después rompe la firma:
    R2 devolvía `SignatureDoesNotMatch` y **ninguna descarga funcionó nunca**. Sólo se ve
    cuando alguien hace clic de verdad; ningún test lo alcanza.
  */
  const url = await enlaceParaMirar(veredicto.clave, DURACION.descarga, nombre);

  return NextResponse.redirect(url);
}
