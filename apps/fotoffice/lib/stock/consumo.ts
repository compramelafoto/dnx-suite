/**
 * Consumo de insumos de una venta (módulo PURO: sin base de datos).
 *
 * Dado lo vendido, las recetas de cada producto y los combos, calcula cuánto
 * de cada insumo hay que restar por renglón. No mira `tracksStock`: si un
 * producto tiene receta, consume.
 */

export type LineaVendida = { ref: string; productId: string | null; qty: number };
export type Receta = { productId: string; insumoId: string; quantity: number; porCada: number };
export type ComponenteCombo = {
  comboProductId: string;
  componentProductId: string;
  quantity: number;
};
export type ConsumoLinea = { ref: string; insumoId: string; qty: number }; // qty > 0, a restar

// `combos.ts` impide los ciclos al guardar; esto es sólo una defensa por si
// llegara un dato corrupto: la recursión se corta y el cálculo termina igual.
const PROFUNDIDAD_MAXIMA = 10;

export function expandirConsumo(
  lineas: readonly LineaVendida[],
  recetas: readonly Receta[],
  combos: readonly ComponenteCombo[],
  insumosValidos: ReadonlySet<string>,
): ConsumoLinea[] {
  const recetasPorProducto = new Map<string, Receta[]>();
  for (const receta of recetas) {
    const lista = recetasPorProducto.get(receta.productId) ?? [];
    lista.push(receta);
    recetasPorProducto.set(receta.productId, lista);
  }
  const componentesPorCombo = new Map<string, ComponenteCombo[]>();
  for (const c of combos) {
    const lista = componentesPorCombo.get(c.comboProductId) ?? [];
    lista.push(c);
    componentesPorCombo.set(c.comboProductId, lista);
  }

  // ref -> insumoId -> cantidad
  const total = new Map<string, Map<string, number>>();

  for (const linea of lineas) {
    if (!linea.productId || !(linea.qty > 0)) continue;

    // Unidades por producto alcanzado dentro de la línea. Si un mismo producto
    // se alcanza por dos caminos, las unidades se suman ANTES de redondear
    // (se redondea una sola vez por producto y línea).
    const unidades = new Map<string, number>();
    const recorrer = (productId: string, qty: number, profundidad: number) => {
      unidades.set(productId, (unidades.get(productId) ?? 0) + qty);
      if (profundidad >= PROFUNDIDAD_MAXIMA) return;
      for (const comp of componentesPorCombo.get(productId) ?? []) {
        recorrer(comp.componentProductId, qty * comp.quantity, profundidad + 1);
      }
    };
    recorrer(linea.productId, linea.qty, 0);

    for (const [productId, units] of unidades) {
      for (const receta of recetasPorProducto.get(productId) ?? []) {
        if (!insumosValidos.has(receta.insumoId)) continue;
        const aporte = Math.ceil(units / Math.max(1, receta.porCada)) * receta.quantity;
        if (!(aporte > 0)) continue;
        const porInsumo = total.get(linea.ref) ?? new Map<string, number>();
        porInsumo.set(receta.insumoId, (porInsumo.get(receta.insumoId) ?? 0) + aporte);
        total.set(linea.ref, porInsumo);
      }
    }
  }

  const salida: ConsumoLinea[] = [];
  for (const ref of [...total.keys()].sort()) {
    const porInsumo = total.get(ref)!;
    for (const insumoId of [...porInsumo.keys()].sort()) {
      salida.push({ ref, insumoId, qty: porInsumo.get(insumoId)! });
    }
  }
  return salida;
}
