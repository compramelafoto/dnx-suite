import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { claveDeLogo, esClaveDeLogo, validarLogo } from "@/lib/logo";
import { perfilDeVenta } from "@/lib/perfil-de-venta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Le da permiso al fotógrafo para subir su logo derecho al bucket.
 *
 * Mismo camino que las fotos del invitado: el archivo no pasa por el servidor. Acá pesa
 * menos —dos megas— pero la razón de fondo es la misma, y de paso es código que ya está
 * probado en el peor escenario, que es el wifi de un salón.
 *
 * La clave se arma con el identificador del perfil que sale de **la sesión**, nunca de lo
 * que manda el navegador: así nadie puede escribir en la carpeta de otro.
 */
export async function POST(req: Request) {
  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let cuerpo: { tipo?: string; bytes?: number };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const revision = validarLogo({
    tipo: String(cuerpo.tipo ?? ""),
    bytes: Number(cuerpo.bytes ?? 0),
  });
  if (!revision.ok) return NextResponse.json({ error: revision.motivo }, { status: 400 });

  const perfilId = await perfilDeVenta(usuario.id, usuario.name);
  const clave = claveDeLogo(perfilId, String(cuerpo.tipo), randomBytes(8).toString("hex"));

  const url = await getSignedUrl(
    almacenamiento(),
    new PutObjectCommand({ Bucket: bucket(), Key: clave, ContentType: String(cuerpo.tipo) }),
    { expiresIn: 300 },
  );

  return NextResponse.json({ url, clave });
}

/**
 * Devuelve el logo del fotógrafo **desde nuestro dominio**, para el kit de venta.
 *
 * Las placas y el folleto se dibujan en un `<canvas>` del navegador. Una imagen de otro
 * dominio sin CORS "ensucia" el lienzo y después no se puede exportar a PNG: la descarga
 * fallaría en silencio. Pasándolo por acá queda del mismo origen.
 *
 * Sólo se sirve una clave de nuestro bucket. Un logo pegado como dirección externa no se
 * baja desde el servidor: sería una puerta para pedirle a nuestro servidor cualquier URL.
 * En ese caso la pieza sale con el nombre del estudio en lugar del logo.
 */
export async function GET() {
  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) return new NextResponse(null, { status: 401 });

  const perfilId = await perfilDeVenta(usuario.id, usuario.name);
  const perfil = await prisma.subilafotoSellerProfile.findUnique({
    where: { id: perfilId },
    select: { logoUrl: true },
  });
  const clave = perfil?.logoUrl;
  if (!clave || !esClaveDeLogo(clave)) return new NextResponse(null, { status: 404 });

  try {
    const objeto = await almacenamiento().send(new GetObjectCommand({ Bucket: bucket(), Key: clave }));
    const bytes = await objeto.Body?.transformToByteArray();
    if (!bytes) return new NextResponse(null, { status: 404 });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": objeto.ContentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // El bucket borra todo a los 30 días, logos incluidos: puede no estar más.
    if ((error as { name?: string }).name === "NoSuchKey") return new NextResponse(null, { status: 404 });
    throw error;
  }
}
