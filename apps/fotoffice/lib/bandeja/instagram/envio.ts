import "server-only";
import { leerTokenInstagram } from "@/lib/integrations/instagram/credentials";
import type { Conexion } from "../conexion";
import type { DepsEnvio, ResultadoEnvio } from "../envio";

/**
 * Salida por mensaje directo de Instagram: `POST /{igPageId}/messages` con el token de la página de
 * Facebook vinculada. Igual que WhatsApp: SIMULADO simula; en REAL manda de verdad o falla con un
 * código (SIN_PAGINA, SIN_TOKEN, el de Meta, el HTTP o RED). Instagram acepta hasta 1000 bytes por
 * mensaje: un texto más largo sale en varias partes. Nunca lanza ni loguea el texto, el IGSID o el token.
 */

/** Máximo de bytes (UTF-8) de un mensaje de texto de Instagram. */
export const BYTES_MAXIMOS_INSTAGRAM = 1000;

const TIEMPO_MAXIMO_MS = 15_000;

const bytesDe = (s: string) => Buffer.byteLength(s, "utf8");

/** Los caracteres que ve una persona (un emoji compuesto es uno solo), para no cortar nunca dentro de uno. */
function caracteres(texto: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter("es", { granularity: "grapheme" }).segment(texto), (s) => s.segment);
  }
  return Array.from(texto);
}

/**
 * Parte el texto en trozos de a lo sumo `max` bytes que, unidos, dan el texto exacto. Corta después
 * de un párrafo (línea en blanco) si puede; si no, después de un espacio; si no, entre caracteres.
 */
export function partirPorBytes(texto: string, max: number = BYTES_MAXIMOS_INSTAGRAM): string[] {
  if (!texto) return [];
  if (bytesDe(texto) <= max) return [texto];
  const cs = caracteres(texto);
  const tam = cs.map(bytesDe);
  const partes: string[] = [];
  let inicio = 0;
  while (inicio < cs.length) {
    let fin = inicio;
    let bytes = 0;
    let finParrafo = -1;
    let finEspacio = -1;
    while (fin < cs.length && bytes + tam[fin] <= max) {
      bytes += tam[fin];
      fin++;
      if (cs[fin - 1] === "\n" && fin - 2 >= inicio && cs[fin - 2] === "\n") finParrafo = fin;
      if (/^\s+$/.test(cs[fin - 1])) finEspacio = fin;
    }
    if (fin >= cs.length) {
      partes.push(cs.slice(inicio).join(""));
      break;
    }
    // Un único carácter de más de `max` bytes (no pasa con 1000): va solo, entero.
    if (fin === inicio) fin = inicio + 1;
    const corte = finParrafo > inicio ? finParrafo : finEspacio > inicio ? finEspacio : fin;
    partes.push(cs.slice(inicio, corte).join(""));
    inicio = corte;
  }
  return partes;
}

export async function enviarTextoInstagram(
  conexion: Pick<Conexion, "workspaceId" | "modo" | "igPageId"> & Partial<Pick<Conexion, "igActivo">>,
  igsid: string,
  texto: string,
  deps: DepsEnvio = {},
): Promise<ResultadoEnvio> {
  if (conexion.modo !== "REAL") return { ok: true, simulado: true };
  if (conexion.igActivo !== true || !conexion.igPageId) return { ok: false, codigo: "SIN_PAGINA" };
  const token = await (deps.leerToken ?? leerTokenInstagram)(conexion.workspaceId).catch(() => null);
  if (!token) return { ok: false, codigo: "SIN_TOKEN" };
  const partes = partirPorBytes(texto);
  if (partes.length === 0) return { ok: false, codigo: "SIN_TEXTO" };

  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${conexion.igPageId}/messages`;
  let ultimoMid = "";
  for (const parte of partes) {
    try {
      const res = await (deps.fetch ?? fetch)(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: igsid }, message: { text: parte } }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      const cuerpo = (await res.json().catch(() => null)) as { message_id?: unknown; error?: { code?: unknown } } | null;
      if (!res.ok) {
        const c = cuerpo?.error?.code;
        // Si ya salieron partes anteriores, igual se marca fallido: desde el panel se puede reenviar.
        return { ok: false, codigo: String(typeof c === "number" || typeof c === "string" ? c : res.status) };
      }
      const mid = cuerpo?.message_id;
      if (typeof mid !== "string" || !mid) return { ok: false, codigo: "SIN_ID" };
      ultimoMid = mid;
    } catch {
      return { ok: false, codigo: "RED" };
    }
  }
  return { ok: true, simulado: false, waMessageId: ultimoMid };
}
