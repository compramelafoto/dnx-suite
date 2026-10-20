import { isInternalPath } from "./format";

/**
 * Tarjeta «aviso» (evento SSE `aviso`): un texto fijo que arma la app (FOTOFFICE: el aviso de
 * privacidad del perfil de precios), con un enlace opcional a una pantalla interna. No lo escribe
 * el modelo: sale tal cual.
 */
export type Aviso = { texto: string; enlace: { etiqueta: string; ruta: string } | null };

export function parseAviso(d: unknown): Aviso | null {
  if (!d || typeof d !== "object") return null;
  const a = d as Record<string, unknown>;
  if (typeof a.texto !== "string" || !a.texto.trim()) return null;
  const e = a.enlace as { etiqueta?: unknown; ruta?: unknown } | null | undefined;
  const enlace =
    e && typeof e.etiqueta === "string" && e.etiqueta.trim() && typeof e.ruta === "string" && isInternalPath(e.ruta)
      ? { etiqueta: e.etiqueta.slice(0, 60), ruta: e.ruta }
      : null;
  return { texto: a.texto.slice(0, 500), enlace };
}
