/**
 * Qué producto del catálogo cobra cada polaroid. Módulo PURO.
 *
 * Regla de Daniel (28/10/2026): cada polaroid se cobra como una copia de la hoja en la que se
 * imprime, con el precio de esa copia según la entrega. La 7,5×10 y la 10×15 salen en una hoja
 * 10×15; la 9×13, en una 13×18. Los productos viven en el catálogo con SKU propio
 * (`POL-<entrega>-<medida>[-<escalón>]`) y se cargaron copiando precio y costo de esa copia.
 */

export type EntregaPolaroid = "INS" | "MAN" | "SEM";

export const ENTREGAS_POLAROID: Array<{ id: EntregaPolaroid; label: string }> = [
  { id: "INS", label: "Instantánea (se imprime en el local)" },
  { id: "MAN", label: "Para mañana" },
  { id: "SEM", label: "Para la próxima semana" },
];

/** La medida de cada opción del diseñador (`components/polaroid/presets.ts`), como va en el SKU. */
const MEDIDA_SKU: Record<string, string> = {
  p75x10: "75x10",
  p9x13: "9x13",
  p15x10: "10x15",
};

/**
 * Para mañana y para la próxima semana se cobran por escalón, como las copias: "más de 10",
 * "más de 50" y "más de 100". Por debajo de 10 rige el primer escalón, igual que en las copias.
 */
export function escalon(cantidad: number): 10 | 50 | 100 {
  if (cantidad > 100) return 100;
  if (cantidad > 50) return 50;
  return 10;
}

export function skuPolaroid(presetId: string, entrega: EntregaPolaroid, cantidad: number): string | null {
  const medida = MEDIDA_SKU[presetId];
  if (!medida) return null;
  return entrega === "INS" ? `POL-INS-${medida}` : `POL-${entrega}-${medida}-${escalon(cantidad)}`;
}

export type RenglonPolaroid = { presetId: string; sku: string; cantidad: number };

/**
 * Lo que hay que cobrar: un renglón por medida, con todas las copias de esa medida juntas (el
 * escalón se decide por el total, como en el mostrador).
 */
export function cobroDePolaroids(
  items: Array<{ presetId: string; copies: number }>,
  entrega: EntregaPolaroid,
): RenglonPolaroid[] {
  const porMedida = new Map<string, number>();
  for (const it of items) {
    const copias = Math.max(1, Math.round(it.copies || 1));
    porMedida.set(it.presetId, (porMedida.get(it.presetId) ?? 0) + copias);
  }
  const renglones: RenglonPolaroid[] = [];
  for (const [presetId, cantidad] of porMedida) {
    const sku = skuPolaroid(presetId, entrega, cantidad);
    if (sku) renglones.push({ presetId, sku, cantidad });
  }
  return renglones;
}
