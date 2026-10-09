import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { yaAcepto } from "@/lib/consentimiento-db";
import { COOKIE_INVITADO, obtenerOCrearSesion } from "@/lib/invitado-cookie";
import { OPCIONES_COOKIE } from "@/lib/sesion";
import { esEmojiValido, puedeReaccionar } from "@/lib/reacciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Un invitado manda un emoji a la pantalla del salón.
 *
 * Se piden las mismas condiciones que para subir una foto —evento abierto y
 * consentimiento aceptado— y por el mismo motivo: la puerta es una pantalla, y cualquiera
 * puede llamar a esta ruta de frente. Si no se controla del lado del servidor, el
 * registro de aceptación que guardamos no prueba nada.
 */
export async function POST(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;

  let cuerpo: { emoji?: unknown };
  try {
    cuerpo = (await req.json()) as { emoji?: unknown };
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const emoji = String(cuerpo.emoji ?? "");
  if (!esEmojiValido(emoji)) {
    return NextResponse.json({ error: "Ese emoji no está en la lista." }, { status: 400 });
  }

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: codigo.toUpperCase() },
    select: { id: true, status: true, activationAt: true, deactivationAt: true },
  });
  if (!evento) return NextResponse.json({ error: "El evento no existe." }, { status: 404 });

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
    El freno. Se cuenta sobre la tabla en vez de llevar un contador en la sesión: a
    escala de un salón son cientos de filas, el índice por invitado ya está, y un
    contador aparte se desincroniza en cuanto algo falla a mitad de camino.
  */
  const [enviadas, ultima] = await Promise.all([
    prisma.subilafotoReaction.count({ where: { guestSessionId: sesion.id } }),
    prisma.subilafotoReaction.findFirst({
      where: { guestSessionId: sesion.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const veredicto = puedeReaccionar({
    enviadas,
    ultimaEl: ultima?.createdAt ?? null,
    ahora: new Date(),
  });
  if (!veredicto.ok) {
    return NextResponse.json({ error: veredicto.motivo }, { status: 429 });
  }

  await prisma.subilafotoReaction.create({
    data: { eventId: evento.id, guestSessionId: sesion.id, emoji },
  });

  const res = NextResponse.json({ ok: true });
  if (sesion.esNueva) {
    res.cookies.set(COOKIE_INVITADO, sesion.token, { ...OPCIONES_COOKIE, maxAge: 86400 });
  }
  return res;
}
