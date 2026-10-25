import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { yaAcepto } from "@/lib/consentimiento-db";
import { COOKIE_INVITADO, obtenerOCrearSesion } from "@/lib/invitado-cookie";
import { validarMensaje } from "@/lib/mensajes";
import { OPCIONES_COOKIE } from "@/lib/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuántos mensajes puede dejar un mismo invitado en toda la noche. */
const TOPE_POR_INVITADO = 10;

/**
 * Un invitado deja un mensaje para la pantalla del salón.
 *
 * Mismas condiciones que para subir una foto —evento abierto, consentimiento aceptado— y
 * por el mismo motivo: la puerta es una pantalla y cualquiera puede llamar a esta ruta
 * de frente.
 *
 * **El mensaje nace en `REVIEW_REQUIRED`, siempre.** No hay forma de que esta ruta lo
 * publique sola: el estado lo decide `validarMensaje`, no el que llama.
 */
export async function POST(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;

  let cuerpo: { texto?: unknown; nombre?: unknown };
  try {
    cuerpo = (await req.json()) as { texto?: unknown; nombre?: unknown };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const veredicto = validarMensaje(String(cuerpo.texto ?? ""));
  if (!veredicto.ok) return NextResponse.json({ error: veredicto.motivo }, { status: 400 });

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: codigo.toUpperCase() },
    select: {
      id: true,
      status: true,
      activationAt: true,
      deactivationAt: true,
      allowMessages: true,
    },
  });
  if (!evento) return NextResponse.json({ error: "El evento no existe." }, { status: 404 });

  if (!evento.allowMessages) {
    return NextResponse.json({ error: "Este evento no recibe mensajes." }, { status: 409 });
  }

  const acceso = estadoDeAcceso(evento, new Date());
  if (!acceso.puedeSubir) {
    return NextResponse.json(
      {
        error:
          acceso.momento === "ANTES"
            ? "El evento todavía no arrancó."
            : "El evento ya terminó.",
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

  /*
    El tope es bajo a propósito y mucho más que el de las reacciones. Un mensaje le cuesta
    al fotógrafo un turno de revisión; diez por invitado ya es generoso en una fiesta.
  */
  const yaDejo = await prisma.subilafotoMedia.count({
    where: { guestSessionId: sesion.id, kind: "MESSAGE" },
  });
  if (yaDejo >= TOPE_POR_INVITADO) {
    return NextResponse.json(
      { error: `Llegaste al tope de ${TOPE_POR_INVITADO} mensajes.` },
      { status: 429 },
    );
  }

  const nombre = String(cuerpo.nombre ?? "").trim().slice(0, 40) || null;

  await prisma.subilafotoMedia.create({
    data: {
      eventId: evento.id,
      guestSessionId: sesion.id,
      kind: "MESSAGE",
      status: veredicto.estadoInicial,
      // Un mensaje no tiene archivo. La columna es obligatoria, así que va vacía.
      originalKey: "",
      caption: veredicto.texto,
      guestName: nombre,
    },
  });

  const res = NextResponse.json({ ok: true, enRevision: true });
  if (sesion.esNueva) {
    res.cookies.set(COOKIE_INVITADO, sesion.token, { ...OPCIONES_COOKIE, maxAge: 86400 });
  }
  return res;
}
