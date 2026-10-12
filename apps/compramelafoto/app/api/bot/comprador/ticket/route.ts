import { abrirCasoComprador } from "@/lib/bot/comprador/caso";
import { actorDesdeConversacion, conversacionHabilitada } from "@/lib/bot/comprador/contexto-pedido";
import { readBuyerBotConfig } from "@/lib/bot/comprador/config";
import { emailVerificadoDe, ipDe, leerGuestKey, sesionVerificada } from "@/lib/bot/comprador/identidad";
import { buscarConversacionComprador } from "@/lib/bot/comprador/store";
import { hashIp } from "@/lib/hidden-album-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIN_MAIL = "Para derivarte necesito tu mail. Escribilo acá en el chat y abro el caso.";
const RESUMEN_POR_DEFECTO = "La persona pidió hablar con alguien del equipo desde DNX Bot.";

/** Botón «Hablar con una persona» de la burbuja de compradores. */
export async function POST(req: Request) {
  if (!readBuyerBotConfig().enabled) return Response.json({ error: "No encontrado" }, { status: 404 });
  const guestKey = leerGuestKey(req.headers.get("cookie"));
  const conv = guestKey ? await buscarConversacionComprador(guestKey) : null;
  if (!guestKey || !conv) return Response.json({ error: SIN_MAIL }, { status: 422 });
  if (!(await conversacionHabilitada(conv.albumId))) return Response.json({ error: "No encontrado" }, { status: 404 });

  const sesion = await sesionVerificada();
  const yaDerivada = conv.status === "ESCALATED" && conv.supportTicketId != null;
  if (!emailVerificadoDe(conv, sesion) && !yaDerivada) return Response.json({ error: SIN_MAIL }, { status: 422 });

  const { resumen } = ((await req.json().catch(() => ({}))) ?? {}) as { resumen?: unknown };
  const actor = await actorDesdeConversacion({
    conv, guestKey, ipHash: hashIp(ipDe(req)), pagina: null, pagePath: null,
    datos: { albumId: conv.albumId, orderId: conv.orderId, enlace: null }, sesion,
  });
  const r = await abrirCasoComprador({
    actor,
    email: null, // usa el verificado
    nombre: null,
    motivo: "otro",
    resumen: (typeof resumen === "string" && resumen.trim().slice(0, 1500)) || RESUMEN_POR_DEFECTO,
    urgente: false,
    // El pedido guardado puede venir de la página de pago, que no prueba que sea suyo: no se anota.
    orderId: null,
  });
  if (!r.ok) return Response.json({ error: r.mensaje }, { status: 429 });
  return Response.json({ ticketId: r.ticketId, reused: r.reused });
}
