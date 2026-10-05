/**
 * El margen de las ventas. Módulo PURO, todo en centavos enteros.
 *
 * La regla que da sentido a todo el archivo: **un costo desconocido no es cero.** Contar
 * como cero el costo de un renglón que no lo tiene infla el margen y hace creer al negocio
 * que ganó más de lo que ganó —un servicio sin costo cargado aparecería como ganancia pura—.
 * Por eso ese renglón suma a la venta, no al costo, y se informa aparte cuántos renglones
 * están en esa situación (`withoutCostCount`): es tan parte del reporte como el margen mismo.
 */

export type MarginLine = {
  productId: string | null;
  description: string;
  qty: number;
  revenueMinor: number;
  costMinor: number | null;
};

/**
 * Los totales del período. `costMinor` nunca es `null` acá —es la suma de lo que SÍ se
 * conoce—, y por eso `withoutCostCount` viaja al lado: sin ese número, un costo total bajo
 * se leería como "se ganó mucho" cuando en realidad puede ser "no se cargó el costo".
 */
export function marginTotals(lines: readonly MarginLine[]): {
  revenueMinor: number;
  costMinor: number;
  marginMinor: number;
  withoutCostCount: number;
} {
  let revenueMinor = 0;
  let costMinor = 0;
  let withoutCostCount = 0;
  for (const l of lines) {
    revenueMinor += l.revenueMinor;
    if (l.costMinor === null) {
      withoutCostCount += 1;
    } else {
      costMinor += l.costMinor;
    }
  }
  return { revenueMinor, costMinor, marginMinor: revenueMinor - costMinor, withoutCostCount };
}

export type ProductMargin = {
  productId: string | null;
  description: string;
  qty: number;
  revenueMinor: number;
  costMinor: number;
  marginMinor: number;
  withoutCostCount: number;
};

/**
 * Agrupa por producto —o por descripción, para el renglón suelto sin `productId`— y ordena
 * de mayor a menor margen: es lo primero que alguien quiere ver, qué producto rinde más.
 */
export function marginByProduct(lines: readonly MarginLine[]): ProductMargin[] {
  const mapa = new Map<string, ProductMargin>();
  for (const l of lines) {
    const clave = l.productId ?? `desc:${l.description}`;
    const actual = mapa.get(clave);
    const revenueMinor = l.revenueMinor;
    const costMinor = l.costMinor ?? 0;
    const withoutCost = l.costMinor === null ? 1 : 0;
    if (actual) {
      actual.qty += l.qty;
      actual.revenueMinor += revenueMinor;
      actual.costMinor += costMinor;
      actual.marginMinor += revenueMinor - costMinor;
      actual.withoutCostCount += withoutCost;
    } else {
      mapa.set(clave, {
        productId: l.productId,
        description: l.description,
        qty: l.qty,
        revenueMinor,
        costMinor,
        marginMinor: revenueMinor - costMinor,
        withoutCostCount: withoutCost,
      });
    }
  }
  return [...mapa.values()].sort((a, b) => b.marginMinor - a.marginMinor);
}
