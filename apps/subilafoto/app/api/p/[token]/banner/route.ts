import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@repo/db";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { validarBanner } from "@/lib/banner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Le da permiso al proveedor para subir su banner derecho al bucket.
 *
 * El proveedor **no tiene cuenta**: entra con el enlace que le pasó el fotógrafo. Por eso
 * el permiso sale del enlace y no de una sesión, con las mismas tres comprobaciones que
 * la ficha —que sea de proveedores, que no esté revocado y que no haya vencido—.
 *
 * La clave se arma acá con el evento que sale de la base, nunca con lo que manda el
 * navegador: si no, alguien con un enlace podría escribir en la carpeta de otro evento.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const enlace = await prisma.subilafotoAccessLink.findUnique({
    where: { token },
    select: { kind: true, revokedAt: true, expiresAt: true, event: { select: { code: true } } },
  });

  if (!enlace || enlace.kind !== "VENDOR" || enlace.revokedAt) {
    return NextResponse.json({ error: "Este enlace no está disponible." }, { status: 404 });
  }
  if (enlace.expiresAt && enlace.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Este enlace venció." }, { status: 410 });
  }

  const cuerpo = (await req.json().catch(() => null)) as
    | { tipo?: string; bytes?: number }
    | null;
  if (!cuerpo?.tipo || typeof cuerpo.bytes !== "number") {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }

  const veredicto = validarBanner({ tipo: cuerpo.tipo, bytes: cuerpo.bytes });
  if (!veredicto.ok) {
    return NextResponse.json({ error: veredicto.motivo }, { status: 400 });
  }

  /*
    Cuelga del evento y no del perfil del vendedor: el banner es de la participación de
    este proveedor en esta fiesta, así que desaparece con ella a los 30 días. El del
    fotógrafo vive aparte porque sobrevive a los eventos.
  */
  const extension = cuerpo.tipo.toLowerCase().includes("png")
    ? "png"
    : cuerpo.tipo.toLowerCase().includes("webp")
      ? "webp"
      : "jpg";
  const clave = `eventos/${enlace.event.code}/proveedor-${randomBytes(8).toString("hex")}.${extension}`;

  const url = await getSignedUrl(
    almacenamiento(),
    new PutObjectCommand({ Bucket: bucket(), Key: clave, ContentType: cuerpo.tipo }),
    { expiresIn: 300 },
  );

  return NextResponse.json({ url, clave });
}
