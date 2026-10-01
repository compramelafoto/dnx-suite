import type { CategoryTotal } from "./balance";

/**
 * Arma las filas de "ingresos y egresos por categoría" del reporte. Módulo PURO: no suma
 * plata —eso ya lo hizo `totalsByCategory`, que está probado—, sólo decide qué filas se
 * muestran y en qué orden.
 */

export type CategoryReportRow = {
  categoryId: string | null;
  categoryName: string;
  totalMinor: number;
  count: number;
};

export type CategoryConfigRow = { id: string; name: string };

/**
 * Completa las categorías configuradas con su total del período, en el orden en que se
 * configuraron.
 *
 * Una categoría activa sin movimientos en el período entra en $0, no desaparece: la
 * Secretaría tiene que poder distinguir "no hubo gastos de Sueldos este mes" de "esta
 * categoría ya no existe", y omitir la fila borra esa distinción.
 *
 * Una categoría dada de baja que sí tuvo movimientos en el período —o un movimiento cargado
 * sin categoría— no está en `categorias` (que sólo trae las activas), pero se agrega al
 * final igual: dejarla afuera haría que el reporte mostrara menos plata de la que realmente
 * entró o salió, el mismo tipo de error que las transferencias pero por el lado de borrar en
 * vez de duplicar.
 */
export function categoryReportRows(
  categorias: readonly CategoryConfigRow[],
  totales: readonly CategoryTotal[],
  kind: "INGRESO" | "EGRESO",
): CategoryReportRow[] {
  const deEsteLado = totales.filter((t) => t.kind === kind);
  const porCategoria = new Map(
    deEsteLado
      .filter((t): t is CategoryTotal & { categoryId: string } => t.categoryId !== null)
      .map((t) => [t.categoryId, t]),
  );
  const idsConfigurados = new Set(categorias.map((c) => c.id));

  const filas: CategoryReportRow[] = categorias.map((c) => {
    const total = porCategoria.get(c.id);
    return { categoryId: c.id, categoryName: c.name, totalMinor: total?.totalMinor ?? 0, count: total?.count ?? 0 };
  });

  for (const t of deEsteLado) {
    if (t.categoryId !== null && idsConfigurados.has(t.categoryId)) continue;
    filas.push({ categoryId: t.categoryId, categoryName: t.categoryName, totalMinor: t.totalMinor, count: t.count });
  }

  return filas;
}
