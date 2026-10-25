/**
 * Presupuesto de ids de una consulta de listado. Cada id que viaja en un `id IN (...)` es un
 * parámetro de la consulta y Postgres admite hasta 32.767 en total: no alcanza con acotar cada
 * lista por separado (dos listas de 20.000 ya se pasan). Este cálculo junta todas las listas de
 * una consulta y decide, una sola vez, lo que viaja:
 *
 * - `y` (AND: filtros, recorridos): se intersecan en una sola lista.
 * - `o` (OR: búsqueda por número, búsqueda en campos): se unen sin repetidos y, si hay lista AND,
 *   sólo quedan los que están en ella (los demás igual quedarían afuera).
 * - Si las dos listas juntas pasan el tope, `excedido`: la lista sale vacía con un aviso, nunca
 *   parcial.
 *
 * Puro: no toca la base.
 */

/** Ids que pueden viajar, entre todas las listas, en una misma consulta. */
export const TOPE_IDS_POR_CONSULTA = 20_000;

/** Las listas de una consulta. Un `null` en `y` es "sin restricción" y se ignora. */
export type ListasDeIds = { y: (readonly string[] | null)[]; o: (readonly string[])[] };

export type PresupuestoDeIds =
  | { excedido: true }
  /** `y`: null si ninguna lista AND restringe; `o`: lo que va al OR de la búsqueda. */
  | { excedido: false; y: string[] | null; o: string[] };

export function presupuestoDeIds(listas: ListasDeIds, tope: number = TOPE_IDS_POR_CONSULTA): PresupuestoDeIds {
  let y: string[] | null = null;
  for (const lista of listas.y) {
    if (lista === null) continue;
    if (y === null) {
      y = Array.from(new Set(lista));
    } else {
      const hay = new Set(lista);
      y = y.filter((id) => hay.has(id));
    }
  }
  const enY = y === null ? null : new Set(y);
  const vistos = new Set<string>();
  const o: string[] = [];
  for (const lista of listas.o) {
    for (const id of lista) {
      if (vistos.has(id) || (enY && !enY.has(id))) continue;
      vistos.add(id);
      o.push(id);
    }
  }
  if ((y?.length ?? 0) + o.length > tope) return { excedido: true };
  return { excedido: false, y, o };
}
