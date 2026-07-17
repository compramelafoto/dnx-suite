/**
 * Formato único de moneda (unidades mínimas).
 * No duplicar divisiones en componentes.
 */

export function currencyFractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: currency.toUpperCase(),
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export function formatMoneyMinor(
  amountMinor: number,
  currency: string,
  locale = "es-AR",
): string {
  const digits = currencyFractionDigits(currency);
  const major = amountMinor / 10 ** digits;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(major);
  } catch {
    return `${major.toFixed(digits)} ${currency.toUpperCase()}`;
  }
}

export function displayPriceLabel(
  price: { amountMinor: number; currency: string; formatted?: string } | null | undefined,
): string | null {
  if (!price) return null;
  if (price.formatted?.trim()) return price.formatted.trim();
  return formatMoneyMinor(price.amountMinor, price.currency);
}
