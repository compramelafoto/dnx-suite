import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_WAIT_DAYS } from "./constants";
import { SUGERENCIA_JSON_SCHEMA, SYSTEM_PROMPT, SugerenciaSchema, type SugerenciaIA } from "./prompt";

/**
 * La única llamada a Claude del módulo. Nunca lanza: una oportunidad que no se pudo analizar
 * queda "para revisar a mano" y el lote sigue. Un fallo de IA no puede dejar la bandeja vacía.
 */
export type LlamadaClaude = (req: { model: string; system: string; contexto: string }) => Promise<{
  texto: string | null;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  modelo: string;
}>;

export type ResultadoAnalisis = {
  sugerencia: SugerenciaIA;
  modelo: string;
  inputTokens: number;
  outputTokens: number;
  fallo: boolean;
};

export function iaDisponible(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
export function modeloIA(): string {
  return process.env.FOTOFFICE_SALES_AI_MODEL?.trim() || "claude-opus-5";
}

const FALLIDA: SugerenciaIA = {
  accion: "REVISAR_A_MANO",
  prioridad: "MEDIA",
  motivo: "No se pudo analizar",
  mensaje: null,
  esperarDias: null,
};

// El cliente se crea recién en el primer uso: así importar este módulo (por ejemplo, en los
// tests) no exige ANTHROPIC_API_KEY ni pega contra la red.
let cliente: Anthropic | null = null;

export const llamadaClaudeReal: LlamadaClaude = async ({ model, system, contexto }) => {
  cliente ??= new Anthropic();
  const r = await cliente.messages.create({
    model,
    max_tokens: 4000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SUGERENCIA_JSON_SCHEMA },
    },
    messages: [{ role: "user", content: contexto }],
  });
  const texto = r.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? null;
  return {
    texto,
    stopReason: r.stop_reason ?? null,
    inputTokens: (r.usage.input_tokens ?? 0) + (r.usage.cache_read_input_tokens ?? 0) + (r.usage.cache_creation_input_tokens ?? 0),
    outputTokens: r.usage.output_tokens ?? 0,
    modelo: r.model,
  };
};

export async function analizarOportunidad(
  contexto: string,
  llamar: LlamadaClaude = llamadaClaudeReal,
): Promise<ResultadoAnalisis> {
  const model = modeloIA();
  try {
    const r = await llamar({ model, system: SYSTEM_PROMPT, contexto });
    if (r.stopReason === "refusal" || !r.texto) {
      return { sugerencia: FALLIDA, modelo: r.modelo, inputTokens: r.inputTokens, outputTokens: r.outputTokens, fallo: true };
    }
    const parsed = SugerenciaSchema.safeParse(JSON.parse(r.texto));
    if (!parsed.success) {
      return { sugerencia: FALLIDA, modelo: r.modelo, inputTokens: r.inputTokens, outputTokens: r.outputTokens, fallo: true };
    }
    const s = parsed.data;
    const sugerencia: SugerenciaIA = {
      ...s,
      esperarDias: s.accion === "ESPERAR" ? s.esperarDias ?? DEFAULT_WAIT_DAYS : null,
      mensaje: s.accion === "ESPERAR" || s.accion === "CERRAR_PERDIDA" ? null : s.mensaje,
    };
    return { sugerencia, modelo: r.modelo, inputTokens: r.inputTokens, outputTokens: r.outputTokens, fallo: false };
  } catch {
    return { sugerencia: FALLIDA, modelo: model, inputTokens: 0, outputTokens: 0, fallo: true };
  }
}
