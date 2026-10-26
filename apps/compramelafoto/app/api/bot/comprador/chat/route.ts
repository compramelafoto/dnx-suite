import { randomUUID } from "node:crypto";
import { windowHistory } from "@repo/dnx-bot";
import { readBotConfig } from "@/lib/bot/config";
import { readBuyerBotConfig } from "@/lib/bot/comprador/config";
import {
  actorDesdeConversacion,
  habilitacionComprador,
  headersInvitado,
  invitadoDe,
} from "@/lib/bot/comprador/contexto-pedido";
import { buildBuyerGuide } from "@/lib/bot/comprador/guia";
import { herramientasComprador } from "@/lib/bot/comprador/herramientas";
import { ACTOR_MOTOR_COMPRADOR, emailVerificadoDe, sesionVerificada } from "@/lib/bot/comprador/identidad";
import {
  liberarReservaComprador,
  registrarUsoComprador,
  reservarTurnoComprador,
  type ReservaComprador,
} from "@/lib/bot/comprador/limites";
import { buildBuyerSituation } from "@/lib/bot/comprador/situacion";
import {
  buscarConversacionComprador,
  crearAccionPendienteComprador,
  continuarConversacionComprador,
  leerConversacionComprador,
  obtenerConversacionComprador,
} from "@/lib/bot/comprador/store";
import { notifyCapThresholds } from "@/lib/bot/tope";
import { respuestaDeTurnoSse } from "@/lib/bot/turno-sse";
import { aplicarEvento } from "@/lib/soporte/aplicar-evento";
import { casoParaComprador, espejarTurnoEnTicket, herramientasDeCaso, situacionDeCaso } from "@/lib/soporte/caso-bot";
import { textoDeMensaje } from "@/lib/soporte/resumen-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Margen para no arrancar otra vuelta con el modelo cerca del límite de la función (como fotógrafos). */
const TURN_BUDGET_MS = 95_000;

export async function POST(req: Request) {
  const deadlineMs = Date.now() + TURN_BUDGET_MS;
  const body = (await req.json().catch(() => null)) as { text?: unknown; pagePath?: unknown } | null;
  const hab = await habilitacionComprador(body?.pagePath);
  if (!hab.habilitado) return new Response("No encontrado", { status: 404 });
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) return new Response("Mensaje vacío", { status: 400 });
  const inv = invitadoDe(req);
  const cfg = readBotConfig();
  const bcfg = readBuyerBotConfig();
  const sesion = await sesionVerificada();
  // Modo caso: la persona vuelve desde el link del mail de soporte y sigue su reclamo acá.
  const pedidoCaso = hab.pagina.tipo === "caso" ? await casoParaComprador(hab.pagina.token, { guestKey: inv.guestKey, ipHash: inv.ipHash }) : null;
  if (pedidoCaso && "error" in pedidoCaso) return Response.json({ error: `caso_${pedidoCaso.error}` }, { status: 410 });
  const caso = pedidoCaso;
  // El mensaje y el gasto estimado se reservan antes del turno; al registrar el uso se ajusta al real.
  // Si el turno termina sin registrar uso, `alTerminar` devuelve el gasto reservado.
  let reserva: ReservaComprador | null = null;
  return respuestaDeTurnoSse({
    model: cfg.model,
    effort: bcfg.effort,
    maxIterations: bcfg.maxIterations,
    deadlineMs,
    text,
    // La cookie nueva va en los headers del Response: después de empezar el stream ya no se puede.
    headers: headersInvitado(inv),
    // Si la base falla acá, el turno se corta con el error amable (no se responde sin límites).
    verificarLimites: async () => {
      const conv = await buscarConversacionComprador(inv.guestKey);
      const verificado = !!emailVerificadoDe(conv ?? { buyerEmail: null, verifiedUntil: null }, sesion);
      const r = await reservarTurnoComprador({
        guestKey: inv.guestKey,
        ipHash: inv.ipHash,
        verificado,
        topeMensualMicroUsd: cfg.limits.monthlyCapMicroUsd,
      });
      if (!r.permitido) return r.mensaje;
      reserva = r.reserva;
      return null;
    },
    preparar: async () => {
      const delCaso = caso ? await leerConversacionComprador(caso.conversationId, inv.guestKey) : null;
      if (caso && !delCaso) throw new Error("conversación del caso no encontrada");
      const conv =
        delCaso ??
        (await obtenerConversacionComprador({
          guestKey: inv.guestKey,
          ipHash: inv.ipHash,
          pagePath: hab.pagePath,
          albumId: hab.datos.albumId,
          orderId: hab.datos.orderId,
          model: cfg.model,
        }));
      // La conversación sigue entera (sólo rota, con resumen, pasado el tope duro en turnos).
      const { conv: actual, history } = await continuarConversacionComprador(conv, { guestKey: inv.guestKey, pagePath: hab.pagePath, model: cfg.model });
      const actor = await actorDesdeConversacion({
        conv: actual, guestKey: inv.guestKey, ipHash: inv.ipHash, pagina: hab.pagina, pagePath: hab.pagePath, datos: hab.datos, sesion,
      });
      const base = await buildBuyerSituation(actor);
      const situation = caso ? `${base}\n\n${await situacionDeCaso(caso.ticketId)}` : base;
      if (caso) await aplicarEvento(caso.ticketId, { tipo: "CLIENTE_ESCRIBIO_BOT" });
      // Al modelo van los últimos turnos; lo anterior, resumido en la situación.
      const ventana = windowHistory(history);
      return {
        conversationId: actual.id,
        history: ventana.messages,
        situation: ventana.summary ? `${situation}\n\n${ventana.summary}` : situation,
        systemGuide: buildBuyerGuide(),
        tools: [...herramientasComprador(actor, { currentUserText: text }), ...(caso ? herramientasDeCaso(caso.ticketId) : [])],
        actor: ACTOR_MOTOR_COMPRADOR,
      };
    },
    registrarUso: async (conversationId, usage, cost) => {
      if (!reserva) throw new Error("uso de comprador sin reserva");
      await registrarUsoComprador({ reserva, conversationId, usage, costMicroUsd: cost });
      reserva = null;
    },
    alGuardar: caso
      ? async (_conversationId, appended) => {
          const textoBot = (appended as { role: string; content: unknown }[])
            .filter((msg) => msg.role === "assistant")
            .map((msg) => textoDeMensaje(msg.content))
            .filter(Boolean)
            .join("\n");
          await espejarTurnoEnTicket(caso.ticketId, { turnoId: randomUUID(), textoUsuario: text, textoBot });
        }
      : undefined,
    alTerminar: async () => {
      if (reserva) await liberarReservaComprador(reserva);
    },
    // En la conversación del comprador (con su ipHash): así cuentan los topes por IP de las tarjetas.
    proponer: (conversationId, w) => crearAccionPendienteComprador({ conversationId, ...w }),
    idsDeIncidente: (conversationId) => ({ conversationId, audiencia: "comprador" }),
    despuesDelTurno: () => notifyCapThresholds(),
  });
}
