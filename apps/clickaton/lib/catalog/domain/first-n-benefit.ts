/**
 * First-N benefit (cupo de beneficio) ≠ capacidad de fase/edición.
 *
 * - `stockLimit` en ClickatonPricePhaseItem = cupo de beneficio (ej. primeros 100 remera).
 * - Agotado → se omite el ítem; la inscripción sigue si hay capacidad general.
 * - Nunca lanzar PHASE_CAPACITY_EXCEEDED por first-N.
 */

export type FirstNPhaseItem = {
  id: string;
  stockLimit?: number | null;
  quantity?: number;
};

export function isFirstNBenefitAvailable(input: {
  stockLimit: number | null | undefined;
  claimed: number;
}): boolean {
  if (input.stockLimit == null) return true;
  if (input.stockLimit < 1) return false;
  return input.claimed < input.stockLimit;
}

/**
 * Filtra ítems de fase agotados. Los omitidos NO bloquean la inscripción.
 */
export function filterPhaseItemsByFirstNQuota<T extends FirstNPhaseItem>(
  items: T[],
  claims: { byItemId: Map<string, number> },
): { available: T[]; omitted: T[] } {
  const available: T[] = [];
  const omitted: T[] = [];
  for (const item of items) {
    const claimed = claims.byItemId.get(item.id) ?? 0;
    if (isFirstNBenefitAvailable({ stockLimit: item.stockLimit, claimed })) {
      available.push(item);
    } else {
      omitted.push(item);
    }
  }
  return { available, omitted };
}
