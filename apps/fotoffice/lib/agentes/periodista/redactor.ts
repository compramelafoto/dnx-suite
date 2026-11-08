import "server-only";
import { Anthropic } from "@repo/dnx-bot";
import { textoDeHtml } from "./copia";
import { conCosto, sumarUso, usoVacio, type UsoClaude } from "./costo";
import { imagenDeHtml, MAX_BYTES_IMAGEN, tipoDeImagenAceptado, type ImagenDeLaFuente } from "./imagen";
import { pedidoDeNota, pedidoDeReescritura, SISTEMA_PERIODISTA, SISTEMA_REESCRITURA } from "./prompts";
import type { TemaPrevio } from "./temas";
import { esDireccionPublica } from "./url";
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

export type { UsoClaude };

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

function nombreDeError(e: unknown): string {
  if (e instanceof Anthropic.APIError) return `la API de Claude respondió ${e.status ?? "sin código"}`;
  if (e instanceof Error && e.name === "AbortError") return "Claude tardó demasiado";
  return e instanceof Error ? e.name : "error desconocido";
}

type Conversacion<T> = {
  sistema: string;
  pedido: string;
  conBusqueda: boolean;
  parsear: (texto: string) => ResultadoParseo<T>;
  hasta: number;
  deps: DepsRedactor;
};

/**
 * La conversación con Claude hasta tener un JSON válido. `parsear` decide si sirve; si no, se le
 * explica el error una sola vez. El uso vuelve con su costo estimado.
 */
async function conversar<T>(input: Conversacion<T>): Promise<ResultadoRedaccion<T>> {
  const res = await conversarSinCosto(input);
  return { ...res, uso: conCosto(res.uso) };
}

async function conversarSinCosto<T>(input: Conversacion<T>): Promise<ResultadoRedaccion<T>> {
  // Se suma CADA respuesta: las continuaciones por pause_turn y el pedido de corrección del JSON.
  const uso: UsoClaude = usoVacio();
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
    sumarUso(uso, r.usage);
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
  input: { hoy: string; excluidas: string[]; temas?: TemaPrevio[]; gustos?: string[]; rechazo?: { tema: string; motivo: string } | null; hasta: number },
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
const AGENTE_HTTP = "Mozilla/5.0 (compatible; DNXPeriodista/1.0)";

export type PaginaDeLaFuente = { texto: string; imagen: ImagenDeLaFuente | null };

/**
 * La página de la noticia, bajada UNA vez: su texto (para el detector de copia) y su imagen
 * principal (para la foto de la nota). Lo mejor que se pueda: si no responde, no es HTML o es
 * enorme, vuelve vacía y el detector usa sólo las citas. Sólo direcciones públicas.
 */
export async function paginaDeLaFuente(url: string, deps: DepsRedactor = {}): Promise<PaginaDeLaFuente> {
  const vacia = { texto: "", imagen: null };
  if (!esDireccionPublica(url)) return vacia;
  try {
    const res = await (deps.fetch ?? fetch)(url, {
      headers: { "User-Agent": AGENTE_HTTP, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return vacia;
    const tipo = res.headers.get("content-type") ?? "";
    if (tipo && !/html|text/i.test(tipo)) return vacia;
    const largo = Number(res.headers.get("content-length") ?? "0");
    if (largo > MAX_BYTES_PAGINA) return vacia;
    const html = (await res.text()).slice(0, MAX_BYTES_PAGINA);
    // Las relativas se resuelven contra la dirección final (después de redirecciones).
    const base = res.url && esDireccionPublica(res.url) ? res.url : url;
    return { texto: textoDeHtml(html), imagen: imagenDeHtml(html, base) };
  } catch {
    return vacia;
  }
}

/** Lee el cuerpo cortando apenas pasa `max` bytes (no confía en content-length). */
async function leerConTope(res: Response, max: number): Promise<Uint8Array | null> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > max ? null : buf;
  }
  const lector = res.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel().catch(() => undefined);
      return null;
    }
    partes.push(value);
  }
  const salida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    salida.set(p, i);
    i += p.byteLength;
  }
  return salida;
}

export type ImagenBajada = { bytes: Uint8Array; tipo: string };

/**
 * Baja la imagen principal de la noticia: sólo direcciones públicas, sólo JPEG/PNG/WebP y hasta
 * 8 MB. Si algo no cumple, null (la nota va sin foto). Nunca lanza.
 */
export async function bajarImagen(url: string, deps: DepsRedactor = {}): Promise<ImagenBajada | null> {
  if (!esDireccionPublica(url)) return null;
  try {
    const res = await (deps.fetch ?? fetch)(url, {
      headers: { "User-Agent": AGENTE_HTTP, Accept: "image/jpeg,image/png,image/webp" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    if (res.url && !esDireccionPublica(res.url)) return null;
    const tipo = tipoDeImagenAceptado(res.headers.get("content-type"));
    if (!tipo) return null;
    const largo = Number(res.headers.get("content-length") ?? "0");
    if (largo > MAX_BYTES_IMAGEN) return null;
    const bytes = await leerConTope(res, MAX_BYTES_IMAGEN);
    return bytes && bytes.byteLength > 0 ? { bytes, tipo } : null;
  } catch {
    return null;
  }
}
