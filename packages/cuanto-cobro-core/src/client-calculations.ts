import { CLIENT_HOUR_FIELDS, CLIENT_HOUR_LABELS, CLIENT_HOUR_RATE_KEY } from "./client-hours";
import { parseQuoteItemHours } from "./quote-items";
import type { QuoteLaborRates } from "./hourly-rates";
import type { CuantoCobroClientInput } from "./types";

export type ClientHourLine = {
  field: (typeof CLIENT_HOUR_FIELDS)[number];
  label: string;
  hours: number;
  rate: number;
  laborCost: number;
};

export type CuantoCobroClientCostSummary = {
  lines: ClientHourLine[];
  totalHours: number;
  laborCost: number;
  /** Sin margen propio del cliente por ahora; mismo valor que laborCost. */
  suggestedPrice: number;
};

export function calculateClientCosts(
  client: CuantoCobroClientInput,
  rates: QuoteLaborRates,
): CuantoCobroClientCostSummary {
  const lines: ClientHourLine[] = [];

  for (const field of CLIENT_HOUR_FIELDS) {
    const hours = parseQuoteItemHours(client.hours[field]);
    if (hours <= 0) continue;
    const rateKey = CLIENT_HOUR_RATE_KEY[field];
    const rate = rates[rateKey];
    const laborCost = Math.round(hours * rate);
    lines.push({
      field,
      label: CLIENT_HOUR_LABELS[field],
      hours,
      rate,
      laborCost,
    });
  }

  const laborCost = lines.reduce((sum, line) => sum + line.laborCost, 0);
  const totalHours = lines.reduce((sum, line) => sum + line.hours, 0);

  return {
    lines,
    totalHours,
    laborCost,
    suggestedPrice: laborCost,
  };
}
