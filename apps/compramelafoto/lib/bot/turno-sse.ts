import { after } from "next/server";
import {
  BotTurnError,
  costMicroUsd,
  encodeSse,
  runBotTurn,
  type BotActor,
  type BotTool,
  type BotTurnResult,
  type BotUsage,
  type ToolOutcome,
} from "@repo/dnx-bot";
import { getAnthropicClient } from "@/lib/bot/anthropic";
import { reportIncident } from "@/lib/bot/escalamiento";
import { appendMessages } from "@/lib/bot/store";

/**
 * Un turno de DNX Bot como respuesta SSE. Lo comparten el chat de fotógrafos y el de compradores:
 * cada ruta pone su identidad, sus límites, su guía y sus herramientas; el turno, el guardado,
 * el registro de uso y los errores son iguales para los dos.
 */

export const FALLA_TURNO = "Tuve un problema para responder. Probá de nuevo en un rato o tocá «Hablar con una persona».";

export type PreparacionTurno = {
  conversationId: string;
  history: unknown[];
  systemGuide: string;
  situation: string;
  tools: BotTool[];
  actor: BotActor;
};

export type TurnoSseParams = {
  model: string;
  effort: "low" | "medium" | "high";
  maxIterations: number;
  deadlineMs: number;
  text: string;
  /** null = sigue; texto = corte (se manda como `error` con offerTicket, sin llamar a la API). */
  verificarLimites: () => Promise<string | null>;
  preparar: () => Promise<PreparacionTurno>;
  registrarUso: (conversationId: string, usage: BotUsage, costMicroUsd: number) => Promise<void>;
  proponer: (conversationId: string, p: { toolName: string; input: unknown; summary: string }) => Promise<{ actionId: string }>;
  alResultado?: (send: (event: string, data: unknown) => void, name: string, outcome: ToolOutcome) => void;
  idsDeIncidente: (conversationId: string) => Record<string, string | number>;
  /** Corre con `after()` cuando el turno terminó y sólo si se registró uso (aviso de tope). */
  despuesDelTurno: () => Promise<void>;
  /** Corre siempre al terminar el turno (haya pasado o no los límites): para liberar reservas. */
  alTerminar?: () => Promise<void>;
  headers?: Record<string, string>;
};

export function respuestaDeTurnoSse(p: TurnoSseParams): Response {
  const encoder = new TextEncoder();

  // El aviso de tope (base + Telegram) corre cuando el turno ya terminó, sin demorar la respuesta.
  let usageRecorded = false;
  let turnFinished!: () => void;
  const finished = new Promise<void>((r) => (turnFinished = r));
  const capCheck = async () => {
    await finished;
    if (usageRecorded) await p.despuesDelTurno();
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
        const corte = await p.verificarLimites();
        if (corte) {
          send("error", { message: corte, offerTicket: true });
          return;
        }
        const prep = await p.preparar();

        // Sólo se guarda el turno si terminó: una falla de la API no deja nada a medio guardar.
        let result: BotTurnResult;
        try {
          result = await runBotTurn({
            client: getAnthropicClient(),
            model: p.model,
            effort: p.effort,
            systemGuide: prep.systemGuide,
            situation: prep.situation,
            tools: prep.tools,
            actor: prep.actor,
            history: prep.history,
            userText: p.text,
            maxIterations: p.maxIterations,
            deadlineMs: p.deadlineMs,
            onText: (delta) => send("text", { delta }),
            proposeWrite: (w) => p.proponer(prep.conversationId, w),
            onProposal: (w) => send("proposal", w),
            onToolResult: p.alResultado ? (name, outcome) => p.alResultado!(send, name, outcome) : undefined,
          });
        } catch (e) {
          // Los mensajes no se guardan (el historial queda como estaba), pero lo que ya se gastó se cobra igual.
          if (e instanceof BotTurnError) {
            try {
              await p.registrarUso(prep.conversationId, e.usage, costMicroUsd(p.model, e.usage));
            } catch (err) {
              console.error("[dnx-bot] uso parcial", err);
            }
            usageRecorded = true;
          }
          const cause = e instanceof BotTurnError ? e.cause : e;
          await reportIncident({
            area: "otro",
            codigo: `api_${cause instanceof Error ? cause.name : "error"}`,
            ids: p.idsDeIncidente(prep.conversationId),
            detalle: cause instanceof Error ? cause.message : String(cause),
            urgente: false,
          }).catch(() => {});
          send("error", { message: FALLA_TURNO, offerTicket: true });
          return;
        }

        await appendMessages(prep.conversationId, result.appended);
        await p.registrarUso(prep.conversationId, result.usage, costMicroUsd(p.model, result.usage));
        usageRecorded = true;
        if (result.outcome !== "ok") {
          await reportIncident({
            area: "otro",
            codigo: `turno_${result.outcome}`,
            ids: { conversationId: prep.conversationId },
            detalle: result.outcome,
            urgente: false,
          }).catch(() => {});
          send("error", { message: FALLA_TURNO, offerTicket: true });
        }
        send("done", { conversationId: prep.conversationId });
      } catch (e) {
        console.error("[dnx-bot] chat", e);
        send("error", { message: FALLA_TURNO, offerTicket: true });
      } finally {
        if (p.alTerminar) {
          try {
            await p.alTerminar();
          } catch (err) {
            console.error("[dnx-bot] al terminar el turno", err);
          }
        }
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
      ...(p.headers ?? {}),
    },
  });
}
