/**
 * Precio de referencia “Antes”: el más alto entre todas las fases activas,
 * solo si supera el precio vigente.
 */
export function resolveRegistrationCompareAt(input: {
  currentAmount: number | null | undefined;
  highestAmount: number | null | undefined;
}): { compareAt: number | null; savings: number | null } {
  const current = input.currentAmount;
  const highest = input.highestAmount;
  if (
    current == null ||
    highest == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(highest) ||
    highest <= current
  ) {
    return { compareAt: null, savings: null };
  }
  return { compareAt: highest, savings: highest - current };
}
