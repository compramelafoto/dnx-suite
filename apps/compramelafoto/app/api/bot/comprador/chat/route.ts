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
import { decidirLimitesComprador, leerUsoComprador, registrarUsoComprador } from "@/lib/bot/comprador/limites";
import { buildBuyerSituation } from "@/lib/bot/comprador/situacion";
import {
  buscarConversacionComprador,
  crearAccionPendienteComprador,
  obtenerConversacionComprador,
} from "@/lib/bot/comprador/store";
import { loadHistory } from "@/lib/bot/store";
import { notifyCapThresholds } from "@/lib/bot/tope";
import { respuestaDeTurnoSse } from "@/lib/bot/turno-sse";

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
      const d = decidirLimitesComprador({
        uso: await leerUsoComprador(inv.guestKey, inv.ipHash),
        verificado,
        topeMensualMicroUsd: cfg.limits.monthlyCapMicroUsd,
      });
      return d.permitido ? null : d.mensaje;
    },
    preparar: async () => {
      const conv = await obtenerConversacionComprador({
        guestKey: inv.guestKey,
        ipHash: inv.ipHash,
        pagePath: hab.pagePath,
        albumId: hab.datos.albumId,
        orderId: hab.datos.orderId,
        model: cfg.model,
      });
      const actor = await actorDesdeConversacion({
        conv, guestKey: inv.guestKey, ipHash: inv.ipHash, pagina: hab.pagina, pagePath: hab.pagePath, datos: hab.datos, sesion,
      });
      const [history, situation] = await Promise.all([loadHistory(conv.id), buildBuyerSituation(actor)]);
      return {
        conversationId: conv.id,
        history,
        situation,
        systemGuide: buildBuyerGuide(),
        tools: herramientasComprador(actor, { currentUserText: text }),
        actor: ACTOR_MOTOR_COMPRADOR,
      };
    },
    registrarUso: (conversationId, usage, cost) =>
      registrarUsoComprador({ guestKey: inv.guestKey, ipHash: inv.ipHash, conversationId, usage, costMicroUsd: cost }),
    // En la conversación del comprador (con su ipHash): así cuentan los topes por IP de las tarjetas.
    proponer: (conversationId, w) => crearAccionPendienteComprador({ conversationId, ...w }),
    idsDeIncidente: (conversationId) => ({ conversationId, audiencia: "comprador" }),
    despuesDelTurno: () => notifyCapThresholds(),
  });
}
