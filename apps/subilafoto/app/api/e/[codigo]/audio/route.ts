import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@repo/db";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { claveDeAudio, validarAudio } from "@/lib/audios";
import { yaAcepto } from "@/lib/consentimiento-db";
import { COOKIE_INVITADO, obtenerOCrearSesion } from "@/lib/invitado-cookie";
import { OPCIONES_COOKIE } from "@/lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuántos saludos grabados puede dejar un mismo invitado. */
const TOPE_POR_INVITADO = 5;

/**
 * Le da permiso al invitado para subir su saludo grabado derecho al bucket.
 *
 * Mismo camino que las fotos: el archivo no pasa por el servidor. Acá pesa poco, pero
 * es el código que ya está probado en el peor escenario, que es el wifi de un salón.
 *
 * Las condiciones son las mismas que para subir una foto —evento abierto y
 * consentimiento aceptado— y por el mismo motivo: la puerta es una pantalla y cualquiera
 * puede llamar a esta ruta de frente.
 */
export async function POST(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;

  let cuerpo: { tipo?: unknown; bytes?: unknown; segundos?: unknown };
  try {
    cuerpo = (await req.json()) as typeof cuerpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const segundos =
    typeof cuerpo.segundos === "number" && Number.isFinite(cuerpo.segundos)
      ? cuerpo.segundos
      : null;

  const revision = validarAudio({
    tipo: String(cuerpo.tipo ?? ""),
    bytes: Number(cuerpo.bytes ?? 0),
    segundos,
  });
  if (!revision.ok) return NextResponse.json({ error: revision.motivo }, { status: 400 });

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: codigo.toUpperCase() },
    select: {
      id: true,
      code: true,
      status: true,
      activationAt: true,
      deactivationAt: true,
      allowMessages: true,
    },
  });
  if (!evento) return NextResponse.json({ error: "El evento no existe." }, { status: 404 });

  // El mismo interruptor que los mensajes: es la misma idea, con la voz.
  if (!evento.allowMessages) {
    return NextResponse.json({ error: "Este evento no recibe saludos." }, { status: 409 });
  }

  const acceso = estadoDeAcceso(evento, new Date());
  if (!acceso.puedeSubir) {
    return NextResponse.json(
      {
        error:
          acceso.momento === "ANTES" ? "El evento todavía no arrancó." : "El evento ya terminó.",
      },
      { status: 409 },
    );
  }

  const almacenCookies = await cookies();
  const tokenInvitado = almacenCookies.get(COOKIE_INVITADO)?.value ?? null;

  if (!(await yaAcepto({ eventoId: evento.id, token: tokenInvitado }))) {
    return NextResponse.json(
      { error: "Antes hay que aceptar las condiciones del evento.", aceptarEn: `/e/${codigo}` },
      { status: 403 },
    );
  }

  const sesion = await obtenerOCrearSesion({ eventoId: evento.id, token: tokenInvitado });

  const yaDejo = await prisma.subilafotoMedia.count({
    where: { guestSessionId: sesion.id, kind: "AUDIO" },
  });
  if (yaDejo >= TOPE_POR_INVITADO) {
    return NextResponse.json(
      { error: `Llegaste al tope de ${TOPE_POR_INVITADO} saludos grabados.` },
      { status: 429 },
    );
  }

  /*
    La fila nace antes que el archivo, igual que con las fotos: así la clave sale de algo
    que ya existe en la base y no de lo que mande el navegador.
  */
  const media = await prisma.subilafotoMedia.create({
    data: {
      eventId: evento.id,
      guestSessionId: sesion.id,
      kind: "AUDIO",
      status: "UPLOADING",
      originalKey: "",
      contentType: String(cuerpo.tipo),
      originalBytes: Number(cuerpo.bytes),
    },
    select: { id: true },
  });

  const clave = claveDeAudio(evento.code, String(cuerpo.tipo), media.id);
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
    { expiresIn: 600 },
  );

  const res = NextResponse.json({ mediaId: media.id, url });
  if (sesion.esNueva) {
    res.cookies.set(COOKIE_INVITADO, sesion.token, { ...OPCIONES_COOKIE, maxAge: 86400 });
  }
  return res;
}
