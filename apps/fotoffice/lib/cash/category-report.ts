import type { CategoryTotal } from "./balance";
import { compararCodigos } from "@/lib/rubros/rubros";

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

// --- Rubros de dos niveles (etapa 3) ---------------------------------------------------------

/** Una fila del informe con su código, si tiene. */
export type CategoryReportChild = CategoryReportRow & { code: string | null };

/**
 * Un rubro de primer nivel con el subtotal de él y sus hijos. `ownMinor`/`ownCount` es lo que
 * se cargó directo en el padre (no en un hijo); `totalMinor`/`count` ya lo incluyen.
 */
export type CategoryReportGroup = CategoryReportChild & {
  ownMinor: number;
  ownCount: number;
  children: CategoryReportChild[];
};

/** Perfil de rubro de una categoría (padre y código), por id. */
export type RubroPerfilMap = ReadonlyMap<string, { parentCategoryId: string | null; code: string | null }>;

/**
 * Agrupa las filas de `categoryReportRows` por rubro padre: cada padre lleva el subtotal suyo y
 * de sus hijos, y los hijos van debajo. NO suma dinero nuevo, sólo reparte las mismas filas: la
 * suma de los subtotales de primer nivel es exactamente la suma de las filas de entrada.
 *
 * - Una categoría sin perfil (o sin padre) es de primer nivel, como siempre.
 * - Un hijo cuyo padre no está entre las filas (un padre dado de baja sin movimientos) igual
 *   se agrupa: el padre aparece en $0 propio con el nombre de `nombres`, para no perder el
 *   subtotal. Si ni el nombre se conoce, el hijo queda suelto en primer nivel.
 * - Orden: por código (3.1.2 antes que 3.1.10); sin código, en el orden de entrada (el que
 *   ya traía el informe). Sin códigos en ningún lado, el orden no cambia.
 */
export function groupCategoryReportRows(
  filas: readonly CategoryReportRow[],
  perfiles: RubroPerfilMap,
  nombres: ReadonlyMap<string, string> = new Map(),
): CategoryReportGroup[] {
  const codigo = (id: string | null) => (id ? perfiles.get(id)?.code ?? null : null);
  const padreDe = (f: CategoryReportRow): string | null => {
    if (!f.categoryId) return null;
    const p = perfiles.get(f.categoryId)?.parentCategoryId ?? null;
    if (!p || p === f.categoryId) return null;
    // Un solo nivel: si el padre a su vez tiene padre (dato viejo o roto), se agrupa igual
    // bajo el padre directo; nunca se encadena.
    const estaEnFilas = filas.some((x) => x.categoryId === p);
    return estaEnFilas || nombres.has(p) ? p : null;
  };

  const grupos = new Map<string, CategoryReportGroup>();
  const orden: { clave: string; code: string | null; i: number }[] = [];
  const claveDe = (f: CategoryReportRow, i: number) => f.categoryId ?? `sin-categoria-${i}`;

  // Primero los de primer nivel, en el orden de entrada.
  filas.forEach((f, i) => {
    if (padreDe(f) !== null) return;
    const clave = claveDe(f, i);
    grupos.set(clave, {
      ...f,
      code: codigo(f.categoryId),
      ownMinor: f.totalMinor,
      ownCount: f.count,
      children: [],
    });
    orden.push({ clave, code: codigo(f.categoryId), i });
  });

  // Después los hijos, sumando al subtotal de su padre.
  filas.forEach((f, i) => {
    const p = padreDe(f);
    if (p === null) return;
    let g = grupos.get(p);
    if (!g) {
      g = {
        categoryId: p,
        categoryName: nombres.get(p) ?? "",
        totalMinor: 0,
        count: 0,
        code: codigo(p),
        ownMinor: 0,
        ownCount: 0,
        children: [],
      };
      grupos.set(p, g);
      orden.push({ clave: p, code: codigo(p), i: filas.length + i });
    }
    g.children.push({ ...f, code: codigo(f.categoryId) });
    g.totalMinor += f.totalMinor;
    g.count += f.count;
  });

  for (const g of grupos.values()) {
    const conIndice = g.children.map((c, i) => ({ c, i }));
    conIndice.sort((a, b) => compararCodigos(a.c.code, b.c.code) || a.i - b.i);
    g.children = conIndice.map((x) => x.c);
  }

  orden.sort((a, b) => compararCodigos(a.code, b.code) || a.i - b.i);
  return orden.map((o) => grupos.get(o.clave)!);
}
