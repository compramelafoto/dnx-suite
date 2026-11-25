/**
 * Lee el margen de ganancia del álbum que manda el panel.
 *
 * 0% es un margen válido (el fotógrafo vende al precio base) y habilita la venta.
 * Sólo un campo vacío o un valor inválido queda en null: sin margen, la venta de
 * impresiones no se habilita.
 */
export function parseAlbumProfitMarginPercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
