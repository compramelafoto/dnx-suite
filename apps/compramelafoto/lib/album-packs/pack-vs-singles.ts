/**
 * Comparación entre un pack de fotos digitales y comprar esas mismas fotos sueltas.
 *
 * Sirve para dos cosas en la galería pública:
 * - mostrar en cada pack cuánto se ahorra frente a las sueltas;
 * - cuando el cliente marca fotos sueltas que coinciden con un pack, ofrecerle pasarlas
 *   al pack con un toque (los clientes de Fotoshow marcaban 10 fotos esperando que se
 *   aplicara el pack de 10, y terminaban pagando 10 × precio unitario).
 *
 * Todo en pesos que paga el cliente (ya con comisión y recargo de extensión si hay).
 */

export type PackForSinglesComparison = {
  id: string;
  name: string;
  price: number;
  clientPriceArs?: number;
  includedPhotoCount: number | null;
  requiresSelection: boolean;
  selectionMode: string;
  compositionFulfillmentKind: "DIGITAL" | "PRINT" | "MIXED";
};

export type PackSavings = {
  singlesTotalArs: number;
  packTotalArs: number;
  savingsArs: number;
  /** Porcentaje entero, redondeado hacia abajo para no prometer de más. */
  savingsPercent: number;
};

/** Pack digital de cantidad fija: el único que se compara contra fotos digitales sueltas. */
export function isFixedDigitalPack(pack: PackForSinglesComparison): boolean {
  const count = Number(pack.includedPhotoCount ?? 0);
  return (
    pack.compositionFulfillmentKind === "DIGITAL" &&
    pack.selectionMode === "FIXED" &&
    pack.requiresSelection &&
    Number.isInteger(count) &&
    count > 0
  );
}

export function packClientTotalArs(pack: PackForSinglesComparison): number {
  return Math.round(pack.clientPriceArs ?? pack.price);
}

/** Ahorro del pack frente a las sueltas; null si el pack no es más barato. */
export function computePackSavings(
  packTotalArs: number,
  singlesTotalArs: number
): PackSavings | null {
  if (!(packTotalArs > 0) || !(singlesTotalArs > 0)) return null;
  const savingsArs = Math.round(singlesTotalArs - packTotalArs);
  if (savingsArs <= 0) return null;
  const savingsPercent = Math.floor((savingsArs / singlesTotalArs) * 100);
  return {
    singlesTotalArs: Math.round(singlesTotalArs),
    packTotalArs: Math.round(packTotalArs),
    savingsArs,
    savingsPercent,
  };
}

/**
 * Pack digital que conviene para una selección de `selectedCount` fotos sueltas:
 * la cantidad del pack tiene que coincidir exacto y el pack tiene que ser más barato.
 * Si hay varios, el más barato.
 */
export function findPackForSinglesSelection<T extends PackForSinglesComparison>(
  packs: T[],
  selectedCount: number,
  singlesTotalArsFor: (count: number) => number
): { pack: T; savings: PackSavings } | null {
  if (!Number.isInteger(selectedCount) || selectedCount <= 0) return null;
  let best: { pack: T; savings: PackSavings } | null = null;
  for (const pack of packs) {
    if (!isFixedDigitalPack(pack)) continue;
    if (Number(pack.includedPhotoCount) !== selectedCount) continue;
    const savings = computePackSavings(
      packClientTotalArs(pack),
      singlesTotalArsFor(selectedCount)
    );
    if (!savings) continue;
    if (!best || savings.packTotalArs < best.savings.packTotalArs) {
      best = { pack, savings };
    }
  }
  return best;
}
