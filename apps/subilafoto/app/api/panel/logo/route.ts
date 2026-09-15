import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { claveDeLogo, validarLogo } from "@/lib/logo";
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
