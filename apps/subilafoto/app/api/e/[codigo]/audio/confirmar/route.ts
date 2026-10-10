import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El invitado terminó de subir su saludo grabado.
 *
 * **Se publica derecho, sin pasar por moderación.** Amazon mira imágenes y no escucha
 * audio, así que no hay nada automático que lo revise. Es la misma decisión del titular
 * del 2026-10-09 que vale para los mensajes de texto, con la misma consecuencia: suena
 * en el salón sin que nadie lo haya escuchado antes.
 *
 * El cambio va con `updateMany` y la condición del estado adentro: si llegan dos avisos
 * juntos, el segundo cambia cero filas. Es lo que evita publicar dos veces.
 */
export async function POST(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;

  let cuerpo: { mediaId?: unknown; nombre?: unknown };
  try {
    cuerpo = (await req.json()) as typeof cuerpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const mediaId = String(cuerpo.mediaId ?? "");
  if (!mediaId) return NextResponse.json({ error: "Falta el saludo." }, { status: 400 });

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: codigo.toUpperCase() },
    select: { id: true },
  });
  if (!evento) return NextResponse.json({ error: "El evento no existe." }, { status: 404 });

  const nombre = String(cuerpo.nombre ?? "").trim().slice(0, 40) || null;

  const cambio = await prisma.subilafotoMedia.updateMany({
    where: { id: mediaId, eventId: evento.id, kind: "AUDIO", status: "UPLOADING" },
    data: { status: "APPROVED", publishedAt: new Date(), guestName: nombre },
  });

  if (cambio.count === 0) {
    return NextResponse.json({ error: "Ese saludo ya se había subido." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
