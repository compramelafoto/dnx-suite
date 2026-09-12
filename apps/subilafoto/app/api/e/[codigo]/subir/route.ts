import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@repo/db";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { validarArchivo, claveDeArchivo } from "@/lib/archivo-subido";
import { puedeSubirOtra } from "@/lib/sesion-invitado";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { COOKIE_INVITADO, obtenerOCrearSesion } from "@/lib/invitado-cookie";
import { OPCIONES_COOKIE } from "@/lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Le da permiso al invitado para subir una foto directo al bucket.
 *
 * La foto NO pasa por el servidor: se sube derecho a R2 con una URL firmada. Vercel corta
 * los cuerpos en 4,5 MB, y aunque no lo hiciera, hacer pasar cien fotos de una fiesta por
 * el servidor es pagar tráfico dos veces y tardar el doble con el wifi del salón.
 */
export async function POST(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;

  let cuerpo: { tipo?: string; bytes?: number; checksum?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: codigo.toUpperCase() },
    select: {
      id: true,
      code: true,
      status: true,
      activationAt: true,
      deactivationAt: true,
      maxUploadsPerGuest: true,
      allowPhotos: true,
    },
  });

  if (!evento) return NextResponse.json({ error: "El evento no existe." }, { status: 404 });

  const acceso = estadoDeAcceso(evento, new Date());
  if (!acceso.puedeSubir || !evento.allowPhotos) {
    return NextResponse.json(
      {
        error:
          acceso.momento === "ANTES"
            ? "El evento todavía no arrancó."
            : "El evento ya terminó y no se pueden subir más fotos.",
      },
      { status: 409 },
    );
  }

  const revision = validarArchivo({
    tipo: String(cuerpo.tipo ?? ""),
    bytes: Number(cuerpo.bytes ?? 0),
  });
  if (!revision.ok) {
    return NextResponse.json({ error: revision.motivo }, { status: 400 });
  }

  const almacenCookies = await cookies();
  const sesion = await obtenerOCrearSesion({
    eventoId: evento.id,
    token: almacenCookies.get(COOKIE_INVITADO)?.value ?? null,
  });

  const tope = puedeSubirOtra({
    subidas: sesion.subidas,
    limite: evento.maxUploadsPerGuest,
  });
  if (!tope.ok) return NextResponse.json({ error: tope.motivo }, { status: 429 });

  const checksum = typeof cuerpo.checksum === "string" ? cuerpo.checksum.slice(0, 64) : null;

  // Si esta misma foto ya está en el evento, no se sube de nuevo. Pasa todo el tiempo:
  // alguien toca "subir" dos veces, o reintenta cuando el wifi se cortó a mitad.
  if (checksum) {
    const yaEsta = await prisma.subilafotoMedia.findFirst({
      where: { eventId: evento.id, checksum },
      select: { id: true },
    });
    if (yaEsta) {
      const res = NextResponse.json({ duplicada: true, mediaId: yaEsta.id });
      if (sesion.esNueva) {
        res.cookies.set(COOKIE_INVITADO, sesion.token, { ...OPCIONES_COOKIE, maxAge: 86400 });
      }
      return res;
    }
  }

  const media = await prisma.subilafotoMedia.create({
    data: {
      eventId: evento.id,
      guestSessionId: sesion.id,
      status: "UPLOADING",
      originalKey: "",
      contentType: String(cuerpo.tipo),
      originalBytes: Number(cuerpo.bytes),
      checksum,
    },
    select: { id: true },
  });

  const clave = claveDeArchivo(evento.code, media.id, String(cuerpo.tipo));
  await prisma.subilafotoMedia.update({
    where: { id: media.id },
    data: { originalKey: clave },
  });

  const url = await getSignedUrl(
    almacenamiento(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: clave,
      ContentType: String(cuerpo.tipo),
    }),
    // Diez minutos: suficiente para una foto pesada con mal wifi, corto para que un
    // enlace filtrado no sirva mañana.
    { expiresIn: 600 },
  );

  const res = NextResponse.json({ mediaId: media.id, url });
  if (sesion.esNueva) {
    res.cookies.set(COOKIE_INVITADO, sesion.token, { ...OPCIONES_COOKIE, maxAge: 86400 });
  }
  return res;
}
