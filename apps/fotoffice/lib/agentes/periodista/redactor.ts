import "server-only";
import { Anthropic } from "@repo/dnx-bot";
import { textoDeHtml } from "./copia";
import {
  pedidoDeNota,
  pedidoDeReescritura,
  SISTEMA_PERIODISTA,
  SISTEMA_REESCRITURA,
  type TrabajoParaFoto,
} from "./prompts";
import { parsearNota, parsearReescritura, type NotaPropuesta, type NotaReescrita, type ResultadoParseo } from "./salida";

/**
 * Las llamadas a Claude del Periodista (Sonnet 5.5). Busca con la herramienta de búsqueda web de la
 * API (del lado del servidor de Anthropic, máx. 5 búsquedas) y contesta un JSON que se valida con
 * zod: si no parsea, se le pide una vez que lo corrija; si tampoco, falla. Nunca lanza.
 *
 * - `pause_turn`: una búsqueda larga puede pausar el turno; se reenvía lo que vino y sigue.
 * - Rechazo (`refusal`): se pide el respaldo del lado del servidor (`fallbacks: "default"`).
 * - Tiempo: todo dentro de un plazo (`hasta`), para no pasarse de los 300 s de la función.
 */

export const MODELO_PERIODISTA = "claude-sonnet-5-5";
const MAX_BUSQUEDAS = 5;
const MAX_VUELTAS = 6;
const MAX_TOKENS = 16_000;
const BETA_RESPALDO = "server-side-fallback-2026-07-01";

type MensajeBeta = Anthropic.Beta.BetaMessageParam;
type RespuestaBeta = Anthropic.Beta.BetaMessage;
type PedidoBeta = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** Lo mínimo del cliente que se usa (las pruebas pasan uno falso). */
export type ClientePeriodista = {
  beta: { messages: { create: (body: PedidoBeta, opciones?: { timeout?: number }) => Promise<RespuestaBeta> } };
};

let cliente: Anthropic | null = null;
let claveDelCliente: string | null = null;

function clienteReal(): ClientePeriodista | null {
  const clave = process.env.ANTHROPIC_API_KEY?.trim();
  if (!clave) return null;
  if (!cliente || claveDelCliente !== clave) {
    // Un reintento; el tiempo de cada pedido lo pone `hasta`.
    cliente = new Anthropic({ apiKey: clave, maxRetries: 1, timeout: 240_000 });
    claveDelCliente = clave;
  }
  return cliente as unknown as ClientePeriodista;
}

export type DepsRedactor = { cliente?: ClientePeriodista | null; fetch?: typeof fetch; ahora?: () => number };

export type UsoClaude = { entrada: number; salida: number; busquedas: number };

export type ResultadoRedaccion<T> =
  | { ok: true; valor: T; extractos: string[]; uso: UsoClaude }
  | { ok: false; motivo: string; uso: UsoClaude };

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

function sumarUso(uso: UsoClaude, r: RespuestaBeta): void {
  uso.entrada += r.usage?.input_tokens ?? 0;
  uso.salida += r.usage?.output_tokens ?? 0;
  const busquedas = (r.usage as { server_tool_use?: { web_search_requests?: number } | null } | undefined)?.server_tool_use?.web_search_requests;
  uso.busquedas += typeof busquedas === "number" ? busquedas : 0;
}

function nombreDeError(e: unknown): string {
  if (e instanceof Anthropic.APIError) return `la API de Claude respondió ${e.status ?? "sin código"}`;
  if (e instanceof Error && e.name === "AbortError") return "Claude tardó demasiado";
  return e instanceof Error ? e.name : "error desconocido";
}

/**
 * La conversación con Claude hasta tener un JSON válido. `parsear` decide si sirve; si no, se le
 * explica el error una sola vez.
 */
async function conversar<T>(input: {
  sistema: string;
  pedido: string;
  conBusqueda: boolean;
  parsear: (texto: string) => ResultadoParseo<T>;
  hasta: number;
  deps: DepsRedactor;
}): Promise<ResultadoRedaccion<T>> {
  const uso: UsoClaude = { entrada: 0, salida: 0, busquedas: 0 };
  const api = input.deps.cliente === undefined ? clienteReal() : input.deps.cliente;
  if (!api) return { ok: false, motivo: "Falta ANTHROPIC_API_KEY en el servidor.", uso };
  const ahora = input.deps.ahora ?? Date.now;
  const mensajes: MensajeBeta[] = [{ role: "user", content: input.pedido }];
  const citas: string[] = [];
  let corregido = false;

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const restante = input.hasta - ahora();
    if (restante < 15_000) return { ok: false, motivo: "Se acabó el tiempo antes de terminar la nota.", uso };
    let r: RespuestaBeta;
    try {
      r = await api.beta.messages.create(
        {
          model: MODELO_PERIODISTA,
          max_tokens: MAX_TOKENS,
          system: [{ type: "text", text: input.sistema, cache_control: { type: "ephemeral" } }],
          messages: mensajes,
          ...(input.conBusqueda
            ? {
                tools: [
                  {
                    type: "web_search_20260209",
                    name: "web_search",
                    max_uses: MAX_BUSQUEDAS,
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
      return { ok: false, motivo: nombreDeError(e), uso };
    }
    sumarUso(uso, r);
    mensajes.push({ role: "assistant", content: r.content as MensajeBeta["content"] });
    citas.push(...citasDe(r.content));

    if (r.stop_reason === "pause_turn") continue;
    if (r.stop_reason === "refusal") return { ok: false, motivo: "Claude no quiso escribir esta nota.", uso };
    if (r.stop_reason === "max_tokens") return { ok: false, motivo: "La respuesta de Claude salió cortada.", uso };

    const p = input.parsear(textoDe(r.content));
    if (p.ok) return { ok: true, valor: p.valor, extractos: citas, uso };
    if (corregido) return { ok: false, motivo: `La respuesta no tenía el formato pedido (${p.error}).`, uso };
    corregido = true;
    mensajes.push({
      role: "user",
      content: `Tu respuesta no sirve todavía: ${p.error}. Corregilo y devolvé SOLO el bloque \`\`\`json completo, sin volver a buscar.`,
    });
  }
  return { ok: false, motivo: "Claude no terminó la nota.", uso };
}

export function buscarYEscribir(
  input: { hoy: string; excluidas: string[]; trabajos: TrabajoParaFoto[]; hasta: number },
  deps: DepsRedactor = {},
): Promise<ResultadoRedaccion<NotaPropuesta>> {
  return conversar({
    sistema: SISTEMA_PERIODISTA,
    pedido: pedidoDeNota(input),
    conBusqueda: true,
    parsear: parsearNota,
    hasta: input.hasta,
    deps,
  });
}

export function reescribir(
  input: {
    nota: NotaReescrita;
    fuente: { titulo: string; url: string };
    pedido: string;
    motivoExtra?: string | null;
    hasta: number;
  },
  deps: DepsRedactor = {},
): Promise<ResultadoRedaccion<NotaReescrita>> {
  return conversar({
    sistema: SISTEMA_REESCRITURA,
    pedido: pedidoDeReescritura(input),
    conBusqueda: false,
    parsear: parsearReescritura,
    hasta: input.hasta,
    deps,
  });
}

const MAX_BYTES_PAGINA = 2_000_000;

/**
 * El texto de la página de la noticia, para el detector de copia. Lo mejor que se pueda: si la
 * página no responde, no es HTML o es enorme, se devuelve vacío y el detector usa sólo las citas.
 */
export async function textoDeLaFuente(url: string, deps: DepsRedactor = {}): Promise<string> {
  try {
    const res = await (deps.fetch ?? fetch)(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DNXPeriodista/1.0)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return "";
    const tipo = res.headers.get("content-type") ?? "";
    if (tipo && !/html|text/i.test(tipo)) return "";
    const largo = Number(res.headers.get("content-length") ?? "0");
    if (largo > MAX_BYTES_PAGINA) return "";
    const html = await res.text();
    return textoDeHtml(html.slice(0, MAX_BYTES_PAGINA));
  } catch {
    return "";
  }
}
