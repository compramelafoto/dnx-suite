/**
 * Abrir la burbuja desde otra parte de la página (los botones «Preguntale al bot» de FOTOFFICE):
 * un evento en `window` con el primer mensaje y un contexto chico que viaja en el cuerpo del chat.
 * El servidor revalida todo lo que llega en el contexto: acá sólo se acota la forma.
 */
export const EVENTO_ABRIR = "dnxbot:abrir";

export type PedidoAbrir = { texto: string; contexto?: Record<string, string> };

const MAX_TEXTO = 2000;
const MAX_VALOR = 100;

export function leerPedidoAbrir(detail: unknown): PedidoAbrir | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown>;
  if (typeof d.texto !== "string" || !d.texto.trim()) return null;
  const texto = d.texto.trim().slice(0, MAX_TEXTO);
  const contexto: Record<string, string> = {};
  if (d.contexto && typeof d.contexto === "object") {
    for (const [k, v] of Object.entries(d.contexto as Record<string, unknown>)) {
      if (typeof v === "string" && v.length <= MAX_VALOR) contexto[k] = v;
    }
  }
  return Object.keys(contexto).length ? { texto, contexto } : { texto };
}

export function abrirDnxBot(p: PedidoAbrir): void {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR, { detail: p }));
}
