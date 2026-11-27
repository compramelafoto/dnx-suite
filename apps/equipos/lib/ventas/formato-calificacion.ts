/**
 * Formato de las calificaciones, sin base de datos: lo usan componentes de `app/_ui` que también
 * terminan en pantallas de cliente.
 */

export type UserRating = { average: number | null; count: number };

export const PROMEDIO = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** «4,5 ★ (12 calificaciones)», «5 ★ (1 calificación)» o «Sin calificaciones todavía». */
export function formatRating(r: UserRating): string {
  if (r.count === 0 || r.average == null) return "Sin calificaciones todavía";
  return `${PROMEDIO.format(r.average)} ★ (${r.count} ${r.count === 1 ? "calificación" : "calificaciones"})`;
}
