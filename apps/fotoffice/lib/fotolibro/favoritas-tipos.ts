import type { Caja } from "./modo/maquetar";

/**
 * Una distribución guardada como favorita: el lugar de cada foto, en proporción del pliego
 * (0 a 1), para que sirva en cualquier medida de libro.
 */
export type Favorita = { id: string; nombre: string; marcos: Caja[] };

export const FAVORITAS_MAX = 100;

const esCaja = (c: unknown): c is Caja =>
  !!c && typeof c === "object" && ["x", "y", "w", "h"].every((k) => typeof (c as Record<string, unknown>)[k] === "number" && Number.isFinite((c as Record<string, number>)[k]));

/** Valida lo que llega del navegador o de la base: marcos dentro del pliego y con tamaño. */
export function leerFavorita(raw: unknown): Favorita | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !Array.isArray(r.marcos) || r.marcos.length === 0 || r.marcos.length > 12) return null;
  const marcos = r.marcos.filter(esCaja).map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h }));
  if (marcos.length !== r.marcos.length || marcos.some((c) => c.w <= 0 || c.h <= 0 || c.x < -0.01 || c.y < -0.01 || c.x + c.w > 1.01 || c.y + c.h > 1.01)) return null;
  return { id: r.id.slice(0, 40), nombre: typeof r.nombre === "string" ? r.nombre.slice(0, 60) : "", marcos };
}
