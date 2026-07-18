export function parseCuantoCobroAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutDecimals = trimmed.split(",")[0] ?? "";
  const digitsOnly = withoutDecimals.replace(/\./g, "").replace(/\D/g, "");
  if (!digitsOnly) return null;

  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCuantoCobroPriceInput(amount: number | string): string {
  const parsed = typeof amount === "number" ? amount : parseCuantoCobroAmount(amount);
  if (parsed === null) return "";
  return parsed.toLocaleString("es-AR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

export function normalizeCuantoCobroPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return "";
  return formatCuantoCobroPriceInput(parsed);
}
