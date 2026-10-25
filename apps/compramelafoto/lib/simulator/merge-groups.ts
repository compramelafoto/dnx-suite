/**
 * Los avatares Rocketbox vienen con decenas de grupos (47) pero sólo dos
 * materiales: cada grupo es una llamada de dibujo. Reordenando los triángulos
 * por material quedan tantos grupos como materiales (de 47 llamadas a 2).
 */

export interface DrawGroup {
  start: number;
  count: number;
  materialIndex?: number;
}

/**
 * Índices reordenados (los triángulos de cada material juntos, en el orden en
 * que aparecían) y los grupos nuevos, uno por material. Null si ya estaba bien.
 */
export function mergeGroupsByMaterial(
  index: ArrayLike<number>,
  groups: readonly DrawGroup[],
): { index: number[]; groups: DrawGroup[] } | null {
  const materials = [...new Set(groups.map((g) => g.materialIndex ?? 0))].sort((a, b) => a - b);
  if (groups.length <= materials.length) return null;
  const out: number[] = [];
  const merged: DrawGroup[] = [];
  for (const m of materials) {
    const start = out.length;
    for (const g of groups) {
      if ((g.materialIndex ?? 0) !== m) continue;
      for (let i = g.start; i < g.start + g.count; i += 1) out.push(index[i]);
    }
    merged.push({ start, count: out.length - start, materialIndex: m });
  }
  return { index: out, groups: merged };
}
