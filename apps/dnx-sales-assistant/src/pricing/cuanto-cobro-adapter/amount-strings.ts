/** Borde compatible: número → string que el motor parsea. Sin redondeo de precio. */
export function amountToCompatibleString(value: number | undefined | null): string {
  if (value === undefined || value === null) return "";
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "0";
  return String(value);
}

export function hoursToCompatibleString(value: number | undefined | null): string {
  return amountToCompatibleString(value);
}
