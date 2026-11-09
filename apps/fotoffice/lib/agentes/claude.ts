import "server-only";
import { Anthropic } from "@repo/dnx-bot";
import { conCosto, sumarUso, usoVacio, type UsoClaude } from "./periodista/costo";

/**
 * La conversación con Claude (Sonnet 5.5) que comparten los agentes (Periodista, Buscador). Puede
 * buscar con la herramienta de búsqueda web de la API (del lado del servidor de Anthropic, por
 * omisión máx. 5 búsquedas) y contesta un JSON que valida `parsear`: si no parsea, se le pide una
 * vez que lo corrija; si tampoco, falla. Nunca lanza.
 *
 * - `pause_turn`: una búsqueda larga puede pausar el turno; se reenvía lo que vino y sigue.
 * - Rechazo (`refusal`): se pide el respaldo del lado del servidor (`fallbacks: "default"`).
 * - Tiempo: todo dentro de un plazo (`hasta`), para no pasarse de los 300 s de la función.
 *
 * Se extrajo tal cual de `periodista/redactor.ts` (los textos de error todavía hablan de "nota").
 */

export const MODELO_CLAUDE = "claude-sonnet-5-5";
const MAX_BUSQUEDAS = 5;
export const MAX_VUELTAS = 6;
const MAX_TOKENS = 16_000;
const BETA_RESPALDO = "server-side-fallback-2026-07-01";

type MensajeBeta = Anthropic.Beta.BetaMessageParam;
type RespuestaBeta = Anthropic.Beta.BetaMessage;
type PedidoBeta = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** Lo mínimo del cliente que se usa (las pruebas pasan uno falso). */
export type ClienteClaude = {
  beta: { messages: { create: (body: PedidoBeta, opciones?: { timeout?: number }) => Promise<RespuestaBeta> } };
};

let cliente: Anthropic | null = null;
let claveDelCliente: string | null = null;

export function clienteReal(): ClienteClaude | null {
  const clave = process.env.ANTHROPIC_API_KEY?.trim();
  if (!clave) return null;
  if (!cliente || claveDelCliente !== clave) {
    // Un reintento; el tiempo de cada pedido lo pone `hasta`.
    cliente = new Anthropic({ apiKey: clave, maxRetries: 1, timeout: 240_000 });
    claveDelCliente = clave;
  }
  return cliente as unknown as ClienteClaude;
}

/** `cliente`: undefined = el real (con ANTHROPIC_API_KEY); null = no hay cliente. */
export type DepsClaude = { cliente?: ClienteClaude | null; ahora?: () => number };

export type { UsoClaude };

export type ResultadoParseo<T> = { ok: true; valor: T } | { ok: false; error: string };

/**
 * Por qué falló, para quien necesite distinguirlo (el Buscador; el Periodista lo ignora):
 * - `SERVICIO`: falla de todo el servicio, no de este pedido (falta la clave, 401/403, 429, 529
 *   sobrecargado, sin conexión, sin crédito). Reintentar el mismo pedido ahora no sirve.
 * - `SIN_TIEMPO`: no se hizo el pedido siguiente porque quedaba poco tiempo (lo ya respondido está en `uso`).
 * - `CORTADA`: un pedido se cortó por tiempo a mitad de camino (Anthropic puede haberlo cobrado).
 * - `TAREA`: falló este pedido en particular (rechazo, respuesta cortada, formato, otro error).
 */
export type FallaClaude = "SERVICIO" | "SIN_TIEMPO" | "CORTADA" | "TAREA";

export type ResultadoRedaccion<T> =
  | { ok: true; valor: T; extractos: string[]; uso: UsoClaude }
  | { ok: false; motivo: string; uso: UsoClaude; falla?: FallaClaude };

function textoDe(contenido: RespuestaBeta["content"]): string {
  return contenido
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

/** Los fragmentos de la fuente que citó el modelo (sirven para el detector de copia). */
function citasDe(contenido: RespuestaBeta["content"]): string[] {
  const citas: string[] = [];
  for (const b of contenido) {
    if (b.type !== "text" || !b.citations) continue;
    for (const c of b.citations) if ("cited_text" in c && typeof c.cited_text === "string" && c.cited_text.trim()) citas.push(c.cited_text);
  }
  return citas;
}

/** Códigos de la API que hablan del servicio entero (clave, permisos, límite, sobrecarga). */
const ESTADOS_DE_SERVICIO = new Set([401, 403, 429, 529]);

function fallaDeError(e: unknown): FallaClaude {
  if (e instanceof Anthropic.APIConnectionTimeoutError || e instanceof Anthropic.APIUserAbortError) return "CORTADA";
  if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) return "CORTADA";
  if (e instanceof Anthropic.APIConnectionError) return "SERVICIO";
  if (e instanceof Anthropic.APIError) {
    if (e.status !== undefined && ESTADOS_DE_SERVICIO.has(e.status)) return "SERVICIO";
    // Sin crédito en la cuenta Anthropic responde 400: tampoco es culpa del pedido.
    if (e.status === 400 && /credit balance/i.test(e.message)) return "SERVICIO";
  }
  return "TAREA";
}

function nombreDeError(e: unknown): string {
  if (e instanceof Anthropic.APIError) return `la API de Claude respondió ${e.status ?? "sin código"}`;
  if (e instanceof Error && e.name === "AbortError") return "Claude tardó demasiado";
  return e instanceof Error ? e.name : "error desconocido";
}

export type Conversacion<T> = {
  sistema: string;
  pedido: string;
  conBusqueda: boolean;
  /** Tope de búsquedas web (sólo con `conBusqueda`). Por omisión 5. */
  maxBusquedas?: number;
  parsear: (texto: string) => ResultadoParseo<T>;
  hasta: number;
  deps: DepsClaude;
};

/**
 * La conversación con Claude hasta tener un JSON válido. `parsear` decide si sirve; si no, se le
 * explica el error una sola vez. El uso vuelve con su costo estimado.
 */
export async function conversar<T>(input: Conversacion<T>): Promise<ResultadoRedaccion<T>> {
  const res = await conversarSinCosto(input);
  return { ...res, uso: conCosto(res.uso) };
}

async function conversarSinCosto<T>(input: Conversacion<T>): Promise<ResultadoRedaccion<T>> {
  // Se suma CADA respuesta: las continuaciones por pause_turn y el pedido de corrección del JSON.
  const uso: UsoClaude = usoVacio();
  const api = input.deps.cliente === undefined ? clienteReal() : input.deps.cliente;
  if (!api) return { ok: false, motivo: "Falta ANTHROPIC_API_KEY en el servidor.", uso, falla: "SERVICIO" };
  const ahora = input.deps.ahora ?? Date.now;
  const mensajes: MensajeBeta[] = [{ role: "user", content: input.pedido }];
  const citas: string[] = [];
  let corregido = false;

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const restante = input.hasta - ahora();
    if (restante < 15_000) return { ok: false, motivo: "Se acabó el tiempo antes de terminar la nota.", uso, falla: "SIN_TIEMPO" };
    let r: RespuestaBeta;
    try {
      r = await api.beta.messages.create(
        {
          model: MODELO_CLAUDE,
          max_tokens: MAX_TOKENS,
          system: [{ type: "text", text: input.sistema, cache_control: { type: "ephemeral" } }],
          messages: mensajes,
          ...(input.conBusqueda
            ? {
                tools: [
                  {
                    type: "web_search_20260209",
                    name: "web_search",
                    max_uses: input.maxBusquedas ?? MAX_BUSQUEDAS,
                    user_location: { type: "approximate", country: "AR", timezone: "America/Argentina/Buenos_Aires" },
                  },
                ],
              }
            : {}),
          output_config: { effort: "medium" },
          betas: [BETA_RESPALDO],
          fallbacks: "default",
        },
        { timeout: restante },
      );
    } catch (e) {
      return { ok: false, motivo: nombreDeError(e), uso, falla: fallaDeError(e) };
    }
    sumarUso(uso, r.usage);
    mensajes.push({ role: "assistant", content: r.content as MensajeBeta["content"] });
    citas.push(...citasDe(r.content));

    if (r.stop_reason === "pause_turn") continue;
    if (r.stop_reason === "refusal") return { ok: false, motivo: "Claude no quiso escribir esta nota.", uso, falla: "TAREA" };
    if (r.stop_reason === "max_tokens") return { ok: false, motivo: "La respuesta de Claude salió cortada.", uso, falla: "TAREA" };

    const p = input.parsear(textoDe(r.content));
    if (p.ok) return { ok: true, valor: p.valor, extractos: citas, uso };
    if (corregido) return { ok: false, motivo: `La respuesta no tenía el formato pedido (${p.error}).`, uso, falla: "TAREA" };
    corregido = true;
    mensajes.push({
      role: "user",
      content: `Tu respuesta no sirve todavía: ${p.error}. Corregilo y devolvé SOLO el bloque \`\`\`json completo, sin volver a buscar.`,
    });
  }
  return { ok: false, motivo: "Claude no terminó la nota.", uso, falla: "TAREA" };
}
