import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { claveDePortada, validarPortada } from "@/lib/portada";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Le da permiso al fotógrafo para subir la portada de un evento derecho al bucket.
 *
 * Mismo camino que las fotos del invitado y que el logo: el archivo no pasa por el
 * servidor. Acá pesa poco, pero es código ya probado en el peor escenario —el wifi de un
 * salón— y de paso esquiva el tope de la función.
 *
 * **La clave se arma con el código del evento que sale de la base**, después de
 * comprobar que ese evento es de quien lo pide. Nunca con lo que manda el navegador: si
 * no, cualquiera podría escribir en la carpeta de un evento ajeno.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id, sellerProfile: { userId: usuario.id } },
    select: { code: true },
  });
  if (!evento) return NextResponse.json({ error: "El evento no existe." }, { status: 404 });

  let cuerpo: { tipo?: unknown; bytes?: unknown };
  try {
    cuerpo = (await req.json()) as { tipo?: unknown; bytes?: unknown };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const revision = validarPortada({
    tipo: String(cuerpo.tipo ?? ""),
    bytes: Number(cuerpo.bytes ?? 0),
  });
  if (!revision.ok) return NextResponse.json({ error: revision.motivo }, { status: 400 });

  const clave = claveDePortada(
    evento.code,
    String(cuerpo.tipo),
    randomBytes(8).toString("hex"),
  );

  const url = await getSignedUrl(
    almacenamiento(),
    new PutObjectCommand({ Bucket: bucket(), Key: clave, ContentType: String(cuerpo.tipo) }),
    { expiresIn: 300 },
  );

  return NextResponse.json({ url, clave });
}
