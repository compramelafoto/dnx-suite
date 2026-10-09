import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La pantalla del salón avisa qué está proyectando.
 *
 * La rotación la decide la pantalla, con su propio reloj: el servidor no tiene forma de
 * saber qué se está viendo. Sin este aviso, una reacción no se puede atribuir a ninguna
 * foto y el contador sólo puede ser del evento entero.
 *
 * **Sin autenticación, a propósito.** Quien tiene la dirección de la pantalla es el DJ,
 * y pedirle una sesión convertiría en un trámite lo que hoy es pegar un enlace. Lo peor
 * que puede hacer alguien que la adivine es atribuirle reacciones a la foto equivocada;
 * no se publica, no se borra y no se cobra nada.
 *
 * Igual se comprueba que la foto sea **de este evento**: sin eso se podrían sumar
 * reacciones a la foto de otra fiesta.
 */
export async function POST(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;

  let cuerpo: { mediaId?: unknown };
  try {
    cuerpo = (await req.json()) as { mediaId?: unknown };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: codigo.toUpperCase() },
    select: { id: true },
  });
  if (!evento) return NextResponse.json({ error: "El evento no existe." }, { status: 404 });

  // `null` es válido: es lo que manda la pantalla mientras muestra el QR o un mensaje.
  const pedido = typeof cuerpo.mediaId === "string" ? cuerpo.mediaId : null;

  let mediaId: string | null = null;
  if (pedido) {
    const foto = await prisma.subilafotoMedia.findFirst({
      where: { id: pedido, eventId: evento.id },
      select: { id: true },
    });
    mediaId = foto?.id ?? null;
  }

  await prisma.subilafotoEvent.update({
    where: { id: evento.id },
    data: { nowShowingMediaId: mediaId, nowShowingAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
