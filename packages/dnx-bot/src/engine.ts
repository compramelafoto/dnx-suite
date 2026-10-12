import { toInputSchema } from "./schema";
import type { BotActor, BotTool } from "./types";

export type BotStreamClient = {
  beta: {
    messages: {
      stream: (params: Record<string, unknown>) => {
        on(event: "text", cb: (delta: string) => void): unknown;
        finalMessage(): Promise<any>;
      };
    };
  };
};

export type BotTurnInput = {
  client: BotStreamClient;
  model: string;
  effort: "low" | "medium" | "high";
  systemGuide: string;
  situation: string;
  tools: BotTool[];
  actor: BotActor;
  history: unknown[];
  userText: string;
  maxIterations: number;
  /** Momento límite (epoch ms). Pasado ese momento no se arranca otra vuelta: se corta con "iteration_cap". */
  deadlineMs?: number;
  onText: (delta: string) => void;
  proposeWrite: (p: { toolName: string; input: unknown; summary: string }) => Promise<{ actionId: string }>;
  onProposal: (p: { actionId: string; summary: string }) => void;
};

type Msg = { role: "user" | "assistant"; content: unknown };
export type BotUsage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number };
export type BotTurnResult = {
  appended: Msg[];
  usage: BotUsage;
  outcome: "ok" | "refusal" | "max_tokens" | "iteration_cap";
};

/** Error de un turno que ya consumió tokens: lleva el uso parcial para poder cobrarlo igual. */
export class BotTurnError extends Error {
  readonly usage: BotUsage;
  constructor(cause: unknown, usage: BotUsage) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "BotTurnError";
    this.usage = usage;
  }
}

export async function runBotTurn(i: BotTurnInput): Promise<BotTurnResult> {
  const toolDefs = i.tools.map((t) => ({ name: t.name, description: t.description, input_schema: toInputSchema(t.input) }));
  const byName = new Map(i.tools.map((t) => [t.name, t]));
  const appended: Msg[] = [{ role: "user", content: i.userText }];
  const usage: BotUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  try {
    return await turnLoop(i, toolDefs, byName, appended, usage);
  } catch (e) {
    throw new BotTurnError(e, { ...usage });
  }
}

async function turnLoop(
  i: BotTurnInput,
  toolDefs: unknown[],
  byName: Map<string, BotTool>,
  appended: Msg[],
  usage: BotUsage,
): Promise<BotTurnResult> {
  for (let iter = 0; iter < i.maxIterations; iter++) {
    // Sin tiempo para otra vuelta: el historial queda válido (termina en el mensaje del usuario o en tool_results).
    if (i.deadlineMs !== undefined && Date.now() > i.deadlineMs) return { appended, usage, outcome: "iteration_cap" };
    const stream = i.client.beta.messages.stream({
      model: i.model,
      max_tokens: 8000,
      // Si el modelo rechaza por seguridad, la API reintenta sola con otro modelo.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: i.effort },
      system: [
        { type: "text", text: i.systemGuide, cache_control: { type: "ephemeral" } },
        { type: "text", text: i.situation },
      ],
      tools: toolDefs,
      // Caché automático del último bloque cacheable: no se toca ningún mensaje guardado del historial.
      cache_control: { type: "ephemeral" },
      messages: [...i.history, ...appended],
    });
    stream.on("text", i.onText);
    const msg = await stream.finalMessage();

    usage.input_tokens += msg.usage?.input_tokens ?? 0;
    usage.output_tokens += msg.usage?.output_tokens ?? 0;
    usage.cache_read_input_tokens += msg.usage?.cache_read_input_tokens ?? 0;
    usage.cache_creation_input_tokens += msg.usage?.cache_creation_input_tokens ?? 0;

    if (msg.stop_reason === "refusal") return { appended, usage, outcome: "refusal" };
    const toolUses = (msg.content as any[]).filter((b) => b.type === "tool_use");
    // Un tool_use cortado por max_tokens quedaría sin tool_result y rompería el historial: no se guarda.
    if (msg.stop_reason === "max_tokens") {
      const hasText = (msg.content as any[]).some((b) => b.type === "text" && typeof b.text === "string" && b.text.length > 0);
      if (toolUses.length === 0 && hasText) appended.push({ role: "assistant", content: msg.content });
      return { appended, usage, outcome: "max_tokens" };
    }
    appended.push({ role: "assistant", content: msg.content });
    if (msg.stop_reason !== "tool_use" || toolUses.length === 0) return { appended, usage, outcome: "ok" };

    const results: unknown[] = [];
    for (const tu of toolUses) {
      results.push(await handleToolUse(i, byName.get(tu.name), tu));
    }
    appended.push({ role: "user", content: results });
  }
  return { appended, usage, outcome: "iteration_cap" };
}

async function handleToolUse(i: BotTurnInput, tool: BotTool | undefined, tu: { id: string; name: string; input: unknown }) {
  const err = (content: string) => ({ type: "tool_result", tool_use_id: tu.id, is_error: true, content });
  if (!tool) return err(`La herramienta ${tu.name} no existe. No inventes herramientas.`);
  const parsed = tool.input.safeParse(tu.input);
  if (!parsed.success) return err(`Datos inválidos: ${parsed.error.message}`);

  if (tool.kind === "read") {
    try {
      const out = await tool.run(parsed.data, i.actor);
      return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out), ...(out.ok ? {} : { is_error: true }) };
    } catch (e) {
      return err(`Falló la consulta: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  let actionId: string;
  let summary: string;
  try {
    if (!tool.describe) throw new Error("la herramienta no tiene describe()");
    summary = await tool.describe(parsed.data, i.actor);
    ({ actionId } = await i.proposeWrite({ toolName: tool.name, input: parsed.data, summary }));
    i.onProposal({ actionId, summary });
  } catch (e) {
    return err(`No se pudo preparar la acción: ${e instanceof Error ? e.message : String(e)}`);
  }
  return {
    type: "tool_result",
    tool_use_id: tu.id,
    content: JSON.stringify({
      estado: "PENDIENTE_DE_CONFIRMACION",
      accion: actionId,
      resumen: summary,
      instruccion: "Todavía NO está hecho. El usuario tiene que tocar «Confirmar» en la tarjeta. No digas que se hizo.",
    }),
  };
}
