/**
 * El portfolio de una categoría de consulta (spec 2026-10-25 §3): lo que elige Daniel para que el
 * cliente vea antes del presupuesto. Módulo PURO: forma, topes y claves.
 *
 * Tres tipos de renglón:
 * - GALERIA: las primeras fotos listas de una galería de FOTOFFICE (hasta `cantidad`);
 * - FOTO: una foto puntual de una galería;
 * - SUBIDA: una foto subida a propósito al bucket de FOTOFFICE, bajo
 *   `fotoffice/<workspace>/portfolio-consultas/`.
 */

export type ItemPortfolio =
  | { tipo: "GALERIA"; galeriaId: string; cantidad: number }
  | { tipo: "FOTO"; galeriaId: string; fotoId: string }
  | { tipo: "SUBIDA"; clave: string; ancho: number | null; alto: number | null };

export const MAX_ITEMS_PORTFOLIO = 40;
/** Lo que se muestra como máximo en la página (liviano en el celular). */
export const MAX_FOTOS_MOSTRADAS = 24;
export const FOTOS_POR_GALERIA = 8;
export const MAX_FOTOS_POR_GALERIA = 24;
/**
 * Tamaño máximo de una foto subida: se suben ya livianas (es para mirar en el celular) y pasan por
 * una acción de servidor, cuyo cuerpo tiene tope de 4 MB (`next.config.ts`).
 */
export const MAX_BYTES_SUBIDA = 3_500_000;
export const TIPOS_SUBIDA: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const ID = /^[a-z0-9]{8,40}$/i;

export function prefijoDeSubidas(workspaceId: string): string {
  return `fotoffice/${workspaceId}/portfolio-consultas/`;
}

export function claveDeSubidaValida(workspaceId: string, clave: unknown): clave is string {
  if (typeof clave !== "string" || clave.length > 300) return false;
  const prefijo = prefijoDeSubidas(workspaceId);
  if (!clave.startsWith(prefijo)) return false;
  return /^[a-z0-9-]{8,80}\.(jpg|png|webp)$/i.test(clave.slice(prefijo.length));
}

const medida = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 20_000 ? v : null);

/** Lo guardado (JSON) → renglones válidos, sin repetidos. Lo que no valida se descarta. */
export function validarPortfolio(workspaceId: string, crudo: unknown): ItemPortfolio[] {
  if (!Array.isArray(crudo)) return [];
  const out: ItemPortfolio[] = [];
  const vistos = new Set<string>();
  for (const x of crudo.slice(0, MAX_ITEMS_PORTFOLIO * 2)) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    let item: ItemPortfolio | null = null;
    if (r.tipo === "GALERIA" && typeof r.galeriaId === "string" && ID.test(r.galeriaId)) {
      const c = typeof r.cantidad === "number" && Number.isInteger(r.cantidad) ? Math.min(Math.max(r.cantidad, 1), MAX_FOTOS_POR_GALERIA) : FOTOS_POR_GALERIA;
      item = { tipo: "GALERIA", galeriaId: r.galeriaId, cantidad: c };
    } else if (r.tipo === "FOTO" && typeof r.galeriaId === "string" && ID.test(r.galeriaId) && typeof r.fotoId === "string" && ID.test(r.fotoId)) {
      item = { tipo: "FOTO", galeriaId: r.galeriaId, fotoId: r.fotoId };
    } else if (r.tipo === "SUBIDA" && claveDeSubidaValida(workspaceId, r.clave)) {
      item = { tipo: "SUBIDA", clave: r.clave, ancho: medida(r.ancho), alto: medida(r.alto) };
    }
    if (!item) continue;
    const clave = item.tipo === "GALERIA" ? `g:${item.galeriaId}` : item.tipo === "FOTO" ? `f:${item.fotoId}` : `s:${item.clave}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(item);
    if (out.length >= MAX_ITEMS_PORTFOLIO) break;
  }
  return out;
}

/** Una foto lista para la página: miniatura (siempre) y vista grande (si hay). */
export type FotoDelPortfolio = { id: string; miniatura: string; grande: string | null; ancho: number | null; alto: number | null };

export type CambioPortfolio =
  | { tipo: "AGREGAR"; item: unknown }
  | { tipo: "QUITAR"; indice: number }
  | { tipo: "MOVER"; indice: number; hacia: -1 | 1 };

/** PURO. Aplica un cambio de la pantalla a la lista (validando lo que se agrega). */
export function aplicarCambio(workspaceId: string, items: readonly ItemPortfolio[], cambio: CambioPortfolio): ItemPortfolio[] {
  const lista = [...items];
  if (cambio.tipo === "AGREGAR") return validarPortfolio(workspaceId, [...lista, cambio.item]);
  const i = cambio.indice;
  if (!Number.isInteger(i) || i < 0 || i >= lista.length) return lista;
  if (cambio.tipo === "QUITAR") {
    lista.splice(i, 1);
    return lista;
  }
  const j = i + cambio.hacia;
  if (j < 0 || j >= lista.length) return lista;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista;
}

/** Recorta al tope de la página y saca repetidas (la misma foto por galería y suelta). */
export function fotosParaMostrar(fotos: readonly FotoDelPortfolio[]): FotoDelPortfolio[] {
  const vistas = new Set<string>();
  const out: FotoDelPortfolio[] = [];
  for (const f of fotos) {
    if (vistas.has(f.id)) continue;
    vistas.add(f.id);
    out.push(f);
    if (out.length >= MAX_FOTOS_MOSTRADAS) break;
  }
  return out;
}
