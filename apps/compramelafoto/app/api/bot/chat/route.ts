import { after } from "next/server";
import { BotTurnError, checkLimits, costMicroUsd, encodeSse, runBotTurn, type BotTurnResult } from "@repo/dnx-bot";
import { getAuthUser } from "@/lib/auth";
import { getAnthropicClient } from "@/lib/bot/anthropic";
import { isBotEnabledForUser, readBotConfig } from "@/lib/bot/config";
import { buildPhotographerSituation } from "@/lib/bot/contexto";
import { reportIncident } from "@/lib/bot/escalamiento";
import { buildSystemGuide } from "@/lib/bot/guia";
import { toolsForActor } from "@/lib/bot/herramientas";
import {
  appendMessages,
  createPendingAction,
  getOrCreateConversation,
  loadHistory,
  recordUsage,
  usageSnapshot,
} from "@/lib/bot/store";
import { notifyCapThresholds } from "@/lib/bot/tope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Margen para no arrancar otra vuelta con el modelo cerca del límite de la función (maxDuration 120 s). */
const TURN_BUDGET_MS = 95_000;

const FALLA = "Tuve un problema para responder. Probá de nuevo en un rato o tocá «Hablar con una persona».";
const PHOTOGRAPHER_ROLES = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);
const SITUACION_NEUTRA =
  "La persona no es fotógrafa en CompraMeLaFoto (o no tiene panel de fotógrafo). No tenés datos de su cuenta: ayudala con dudas generales o derivala a una persona.";

export async function POST(req: Request) {
  const deadlineMs = Date.now() + TURN_BUDGET_MS;
  const user = await getAuthUser();
  if (!user) return new Response("No autenticado", { status: 401 });
  if (!(await isBotEnabledForUser(user.id))) return new Response("No encontrado", { status: 404 });

  const body = (await req.json().catch(() => null)) as { text?: unknown; pagePath?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
  if (!text) return new Response("Mensaje vacío", { status: 400 });
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.slice(0, 200) : null;

  const cfg = readBotConfig();
  const actor = { userId: user.id, role: String(user.role), email: user.email, name: user.name };
  const isPhotographer = PHOTOGRAPHER_ROLES.has(actor.role);
  const encoder = new TextEncoder();

  // El aviso de tope (base + Telegram) corre cuando el turno ya terminó, sin demorar la respuesta.
  let usageRecorded = false;
  let turnFinished!: () => void;
  const finished = new Promise<void>((r) => (turnFinished = r));
  const capCheck = async () => {
    await finished;
    if (usageRecorded) await notifyCapThresholds();
  };
  try {
    after(capCheck);
  } catch {
    void capCheck().catch(() => {}); // fuera del contexto de una petición (no debería pasar)
  }

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      // Si la persona cierra el panel, el turno sigue y se guarda igual: enviar no debe romperlo.
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(encodeSse(event, data)));
        } catch {
          open = false;
        }
      };
      try {
        const decision = checkLimits(cfg.limits, await usageSnapshot(user.id));
        if (!decision.allowed) {
          send("error", { message: decision.message, offerTicket: true });
          return;
        }
        const conv = await getOrCreateConversation({ userId: user.id, pagePath, model: cfg.model });
        const [history, situation] = await Promise.all([
          loadHistory(conv.id),
          isPhotographer ? buildPhotographerSituation(user.id).then((s) => s.text) : Promise.resolve(SITUACION_NEUTRA),
        ]);

        // Sólo se guarda el turno si terminó: una falla de la API no deja nada a medio guardar.
        let result: BotTurnResult;
        try {
          result = await runBotTurn({
            client: getAnthropicClient(),
            model: cfg.model,
            effort: cfg.effort,
            systemGuide: buildSystemGuide(),
            situation,
            tools: toolsForActor(actor, { conversationId: conv.id, currentUserText: text }),
            actor,
            history,
            userText: text,
            maxIterations: cfg.maxIterations,
            deadlineMs,
            onText: (delta) => send("text", { delta }),
            proposeWrite: (p) => createPendingAction({ conversationId: conv.id, userId: user.id, ...p }),
            onProposal: (p) => send("proposal", p),
          });
        } catch (e) {
          // Los mensajes no se guardan (el historial queda como estaba), pero lo que ya se gastó se cobra igual.
          if (e instanceof BotTurnError) {
            try {
              await recordUsage({
                userId: user.id,
                conversationId: conv.id,
                usage: e.usage,
                costMicroUsd: costMicroUsd(cfg.model, e.usage),
                countMessage: true,
              });
            } catch (err) {
              console.error("[dnx-bot] uso parcial", err);
            }
            usageRecorded = true;
          }
          const cause = e instanceof BotTurnError ? e.cause : e;
          await reportIncident({
            area: "otro",
            codigo: `api_${cause instanceof Error ? cause.name : "error"}`,
            ids: { userId: user.id, conversationId: conv.id },
            detalle: cause instanceof Error ? cause.message : String(cause),
            urgente: false,
          }).catch(() => {});
          send("error", { message: FALLA, offerTicket: true });
          return;
        }

        await appendMessages(conv.id, result.appended);
        await recordUsage({
          userId: user.id,
          conversationId: conv.id,
          usage: result.usage,
          costMicroUsd: costMicroUsd(cfg.model, result.usage),
          countMessage: true,
        });
        usageRecorded = true;
        if (result.outcome !== "ok") {
          await reportIncident({
            area: "otro",
            codigo: `turno_${result.outcome}`,
            ids: { conversationId: conv.id },
            detalle: result.outcome,
            urgente: false,
          }).catch(() => {});
          send("error", { message: FALLA, offerTicket: true });
        }
        send("done", { conversationId: conv.id });
      } catch (e) {
        console.error("[dnx-bot] chat", e);
        send("error", { message: FALLA, offerTicket: true });
      } finally {
        turnFinished();
        if (open) {
          try {
            controller.close();
          } catch {
            // ya cerrado por el cliente
          }
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
