export const CUANTO_COBRO_QUOTE_NUMBER_PREFIX = "CC";

export function formatQuoteNumber(year: number, sequence: number): string {
  return `${CUANTO_COBRO_QUOTE_NUMBER_PREFIX}-${year}-${String(sequence).padStart(6, "0")}`;
}
