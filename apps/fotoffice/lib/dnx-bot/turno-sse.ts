import "server-only";
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
import { clienteAnthropic } from "./anthropic";
import { reportarIncidente } from "./incidentes";
import { agregarMensajes } from "./store";

/**
 * Un turno de DNX Bot como respuesta SSE (molde de `apps/compramelafoto/lib/bot/turno-sse.ts`).
 * Diferencias: no hay tickets (todo `error` sale con `offerTicket: false`) y los incidentes van a la
 * plataforma del workspace. Sólo se guarda el turno si terminó; lo que se gastó se cobra siempre.
 */

export const FALLA_TURNO = "Tuve un problema para responder. Probá de nuevo en un rato.";

export type PreparacionTurno = {
  conversationId: string;
  history: unknown[];
  systemGuide: string;
  situation: string;
  tools: BotTool[];
  actor: BotActor;
};

export type TurnoParams = {
  model: string;
  effort: "low" | "medium" | "high";
  maxIterations: number;
  deadlineMs: number;
  text: string;
  /** "FOTOFFICE:<workspaceId>": a dónde van los incidentes. */
  plataforma: string;
  /** null = sigue; texto = corte (se manda como `error`, sin llamar a la API). */
  verificarLimites: () => Promise<string | null>;
  preparar: () => Promise<PreparacionTurno>;
  registrarUso: (conversationId: string, usage: BotUsage, costMicroUsd: number) => Promise<void>;
  proponer: (conversationId: string, p: { toolName: string; input: unknown; summary: string }) => Promise<{ actionId: string }>;
  /** Tras cada herramienta de lectura: para mandar tarjetas a la burbuja (etapas 1–3). */
  alResultado?: (send: (event: string, data: unknown) => void, name: string, outcome: ToolOutcome) => void;
  idsDeIncidente: (conversationId: string) => Record<string, string | number>;
  /**
   * Revisión del texto final (verificador de cifras, etapa 1). Si devuelve un aviso, sale como
   * texto antes de `done`. Si falla, el turno termina igual.
   */
  revisarRespuesta?: (p: { texto: string; appended: unknown[]; history: unknown[]; conversationId: string }) => Promise<string | null>;
  /** Corre con `after()` cuando el turno terminó y sólo si se registró uso (avisos de tope). */
  despuesDelTurno: () => Promise<void>;
};

export function respuestaDeTurno(p: TurnoParams): Response {
  const encoder = new TextEncoder();

  let usoRegistrado = false;
  let terminar!: () => void;
  const terminado = new Promise<void>((r) => (terminar = r));
  const avisos = async () => {
    await terminado;
    if (usoRegistrado) await p.despuesDelTurno();
  };
  try {
    after(avisos);
  } catch {
    void avisos().catch(() => {}); // fuera de una petición (no debería pasar)
  }

  const incidente = (codigo: string, ids: Record<string, string | number>, detalle: string) =>
    reportarIncidente({ plataforma: p.plataforma, area: "chat", codigo, ids, detalle, urgente: false }).catch(() => {});

  const stream = new ReadableStream({
    async start(controller) {
      let abierto = true;
      // Si la persona cierra la burbuja, el turno sigue y se guarda igual.
      const send = (event: string, data: unknown) => {
        if (!abierto) return;
        try {
          controller.enqueue(encoder.encode(encodeSse(event, data)));
        } catch {
          abierto = false;
        }
      };
      const error = (message: string) => send("error", { message, offerTicket: false });
      try {
        const corte = await p.verificarLimites();
        if (corte) {
          error(corte);
          return;
        }
        const prep = await p.preparar();

        let result: BotTurnResult;
        let texto = "";
        try {
          result = await runBotTurn({
            client: clienteAnthropic(),
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
            onText: (delta) => {
              texto += delta;
              send("text", { delta });
            },
            proposeWrite: (w) => p.proponer(prep.conversationId, w),
            onProposal: (w) => send("proposal", w),
            onToolResult: p.alResultado ? (name, outcome) => p.alResultado!(send, name, outcome) : undefined,
          });
        } catch (e) {
          if (e instanceof BotTurnError) {
            try {
              await p.registrarUso(prep.conversationId, e.usage, costMicroUsd(p.model, e.usage));
              usoRegistrado = true;
            } catch (err) {
              console.error("[dnx-bot] uso parcial", err);
            }
          }
          const causa = e instanceof BotTurnError ? e.cause : e;
          await incidente(
            `api_${causa instanceof Error ? causa.name : "error"}`,
            p.idsDeIncidente(prep.conversationId),
            causa instanceof Error ? causa.message : String(causa),
          );
          error(FALLA_TURNO);
          return;
        }

        await agregarMensajes(prep.conversationId, result.appended);
        await p.registrarUso(prep.conversationId, result.usage, costMicroUsd(p.model, result.usage));
        usoRegistrado = true;
        if (result.outcome !== "ok") {
          await incidente(`turno_${result.outcome}`, p.idsDeIncidente(prep.conversationId), result.outcome);
          error(FALLA_TURNO);
        } else if (p.revisarRespuesta) {
          try {
            const aviso = await p.revisarRespuesta({ texto, appended: result.appended, history: prep.history, conversationId: prep.conversationId });
            if (aviso) send("text", { delta: `\n\n${aviso}` });
          } catch (e) {
            console.error("[dnx-bot] revisar respuesta", e);
          }
        }
        send("done", { conversationId: prep.conversationId });
      } catch (e) {
        console.error("[dnx-bot] chat", e);
        error(FALLA_TURNO);
      } finally {
        terminar();
        if (abierto) {
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
