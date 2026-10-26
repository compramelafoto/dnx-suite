import { randomUUID } from "node:crypto";
import { checkLimits, windowHistory } from "@repo/dnx-bot";
import { getAuthUser } from "@/lib/auth";
import { isBotEnabledForUser, readBotConfig } from "@/lib/bot/config";
import { buildPhotographerSituation } from "@/lib/bot/contexto";
import { buildSystemGuide } from "@/lib/bot/guia";
import { toolsForActor } from "@/lib/bot/herramientas";
import { continueConversation, createPendingAction, getOrCreateConversation, recordUsage, usageSnapshot } from "@/lib/bot/store";
import { notifyCapThresholds } from "@/lib/bot/tope";
import { respuestaDeTurnoSse } from "@/lib/bot/turno-sse";
import { aplicarEvento } from "@/lib/soporte/aplicar-evento";
import { casoParaFotografo, espejarTurnoEnTicket, herramientasDeCaso, situacionDeCaso } from "@/lib/soporte/caso-bot";
import { textoDeMensaje } from "@/lib/soporte/resumen-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Margen para no arrancar otra vuelta con el modelo cerca del límite de la función (maxDuration 120 s). */
const TURN_BUDGET_MS = 95_000;

const PHOTOGRAPHER_ROLES = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);
const SITUACION_NEUTRA =
  "La persona no es fotógrafa en CompraMeLaFoto (o no tiene panel de fotógrafo). No tenés datos de su cuenta: ayudala con dudas generales o derivala a una persona.";

export async function POST(req: Request) {
  const deadlineMs = Date.now() + TURN_BUDGET_MS;
  const user = await getAuthUser();
  if (!user) return new Response("No autenticado", { status: 401 });
  if (!(await isBotEnabledForUser(user.id))) return new Response("No encontrado", { status: 404 });

  const body = (await req.json().catch(() => null)) as { text?: unknown; pagePath?: unknown; casoToken?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) return new Response("Mensaje vacío", { status: 400 });
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.slice(0, 200) : null;

  // Modo caso: el token del mail sólo ubica el reclamo; tiene que ser de la cuenta con sesión.
  const pedido = typeof body?.casoToken === "string" && body.casoToken ? await casoParaFotografo(body.casoToken, { id: user.id, email: user.email }) : null;
  if (pedido && "error" in pedido) {
    return pedido.error === "ajeno"
      ? new Response("No autorizado", { status: 403 })
      : Response.json({ error: "caso_vencido" }, { status: 410 });
  }
  const caso = pedido;
  const cfg = readBotConfig();
  const actor = { userId: user.id, role: String(user.role), email: user.email, name: user.name };
  const isPhotographer = PHOTOGRAPHER_ROLES.has(actor.role);
  return respuestaDeTurnoSse({
    model: cfg.model,
    effort: cfg.effort,
    maxIterations: cfg.maxIterations,
    deadlineMs,
    text,
    verificarLimites: async () => {
      const d = checkLimits(cfg.limits, await usageSnapshot(user.id));
      return d.allowed ? null : d.message;
    },
    preparar: async () => {
      const abierta = caso
        ? { id: caso.conversationId, status: "ESCALATED" as const, supportTicketId: caso.ticketId }
        : await getOrCreateConversation({ userId: user.id, pagePath, model: cfg.model });
      if (caso) await aplicarEvento(caso.ticketId, { tipo: "CLIENTE_ESCRIBIO_BOT" });
      const [{ conv, history }, situation] = await Promise.all([
        continueConversation(abierta, { userId: user.id, pagePath, model: cfg.model }),
        isPhotographer ? buildPhotographerSituation(user.id).then((s) => s.text) : Promise.resolve(SITUACION_NEUTRA),
      ]);
      // La conversación sigue entera; al modelo van los últimos turnos y lo anterior, resumido.
      const ventana = windowHistory(history);
      const conCaso = caso ? `${situation}\n\n${await situacionDeCaso(caso.ticketId)}` : situation;
      return {
        conversationId: conv.id,
        history: ventana.messages,
        situation: ventana.summary ? `${conCaso}\n\n${ventana.summary}` : conCaso,
        systemGuide: buildSystemGuide(),
        tools: [...toolsForActor(actor, { conversationId: conv.id, currentUserText: text }), ...(caso ? herramientasDeCaso(caso.ticketId) : [])],
        actor,
      };
    },
    registrarUso: (conversationId, usage, cost) =>
      recordUsage({ userId: user.id, conversationId, usage, costMicroUsd: cost, countMessage: true }),
    proponer: (conversationId, w) => createPendingAction({ conversationId, userId: user.id, ...w }),
    // La tarjeta de progreso escolar de la burbuja se actualiza cada vez que el bot lo consulta.
    alResultado: (send, name, outcome) => {
      if (name === "ver_progreso_escolar" && outcome.ok && outcome.data) send("progreso", outcome.data);
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
    idsDeIncidente: (conversationId) => ({ userId: user.id, conversationId }),
    despuesDelTurno: () => notifyCapThresholds(),
  });
}
