import "server-only";
import { conversar, MODELO_CLAUDE, type ClienteClaude, type DepsClaude, type ResultadoRedaccion } from "../claude";
import { textoDeHtml } from "./copia";
import type { UsoClaude } from "./costo";
import { imagenDeHtml, MAX_BYTES_IMAGEN, tipoDeImagenAceptado, type ImagenDeLaFuente } from "./imagen";
import { pedidoDeNota, pedidoDeReescritura, SISTEMA_PERIODISTA, SISTEMA_REESCRITURA } from "./prompts";
import type { TemaPrevio } from "./temas";
import { esDireccionPublica } from "./url";
import { parsearNota, parsearReescritura, type NotaPropuesta, type NotaReescrita } from "./salida";

/**
 * Las llamadas a Claude del Periodista (Sonnet 5.5). La conversación (búsqueda web, JSON validado
 * con zod, pause_turn, respaldo y plazo) vive en `../claude.ts`, compartida con otros agentes;
 * acá quedan los pedidos del Periodista y la bajada de la página y la imagen de la fuente.
 */

export const MODELO_PERIODISTA = MODELO_CLAUDE;

/** Lo mínimo del cliente que se usa (las pruebas pasan uno falso). */
export type ClientePeriodista = ClienteClaude;

export type DepsRedactor = DepsClaude & { fetch?: typeof fetch };

export type { UsoClaude, ResultadoRedaccion };

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
