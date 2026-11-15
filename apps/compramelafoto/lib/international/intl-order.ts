import { INTL_COMMISSION_PERCENT } from "./pilot";
import { minorUnitDigits } from "./money";

/** Monedas que Mercado Pago cobra sin decimales: el total tiene que quedar en unidades enteras. */
const MP_WHOLE_UNIT_CURRENCIES = new Set(["CLP", "COP"]);

export const INTL_SNAPSHOT_KEY = "intlV1";

/** Un álbum en otra moneda que no sea pesos va por el camino internacional. Vacío = pesos. */
export function shouldUseIntlFlow(albumCurrency: string | null | undefined): boolean {
  const c = (albumCurrency ?? "").trim();
  return c !== "" && c !== "ARS";
}

export function mpRequiresWholeUnits(currency: string): boolean {
  return MP_WHOLE_UNIT_CURRENCIES.has(currency);
}

/** Redondea un monto guardado a unidades enteras de la moneda (ej. COP guarda centavos). */
export function roundToWholeUnits(stored: number, currency: string): number {
  const step = 10 ** minorUnitDigits(currency);
  return Math.round(stored / step) * step;
}

/**
 * Precio del fotógrafo + 15 % de comisión, en la unidad guardada de la moneda.
 * En COP y CLP la comisión se redondea a unidades enteras para que Mercado Pago acepte el total.
 */
export function computeIntlDigitalTotals(params: { unitPriceStored: number; photoCount: number; currency: string }): {
  subtotalStored: number;
  commissionStored: number;
  totalStored: number;
} {
  const subtotalStored = params.unitPriceStored * params.photoCount;
  const raw = Math.round((subtotalStored * INTL_COMMISSION_PERCENT) / 100);
  const commissionStored = MP_WHOLE_UNIT_CURRENCIES.has(params.currency) ? roundToWholeUnits(raw, params.currency) : raw;
  return { subtotalStored, commissionStored, totalStored: subtotalStored + commissionStored };
}

export type IntlSaleBlock =
  | "NOT_PILOT"
  | "EVENT_ALBUM"
  | "NO_MP"
  | "MP_COUNTRY_MISMATCH"
  | "NO_BALANCE"
  | "NO_FX"
  | "NOT_DIGITAL_ONLY"
  | "NO_PRICE";

export function canSellIntl(input: {
  pilot: boolean;
  mpConnected: boolean;
  mpCurrency: string | null;
  albumCurrency: string;
  balanceUsdCents: number;
  hasFx: boolean;
  allDigital: boolean;
  unitPriceStored: number | null;
  /** Álbum dentro de un evento (puede cobrar el organizador): fuera del piloto. */
  inEvent: boolean;
}): { ok: true } | { ok: false; block: IntlSaleBlock } {
  if (!input.pilot) return { ok: false, block: "NOT_PILOT" };
  if (input.inEvent) return { ok: false, block: "EVENT_ALBUM" };
  if (!input.mpConnected) return { ok: false, block: "NO_MP" };
  if (input.mpCurrency !== input.albumCurrency) return { ok: false, block: "MP_COUNTRY_MISMATCH" };
  if (!input.allDigital) return { ok: false, block: "NOT_DIGITAL_ONLY" };
  if (!input.unitPriceStored || input.unitPriceStored <= 0) return { ok: false, block: "NO_PRICE" };
  if (!input.hasFx) return { ok: false, block: "NO_FX" };
  if (input.balanceUsdCents <= 0) return { ok: false, block: "NO_BALANCE" };
  return { ok: true };
}

/** Mensaje para el cliente: no se explica el motivo interno. */
export function intlBlockMessage(_block: IntlSaleBlock): string {
  return "La venta de este álbum está pausada momentáneamente. Probá de nuevo más tarde.";
}

export function buildIntlSnapshot(p: { currency: string; subtotalStored: number; commissionStored: number }) {
  return {
    [INTL_SNAPSHOT_KEY]: {
      commissionPercent: INTL_COMMISSION_PERCENT,
      subtotalStored: p.subtotalStored,
      commissionStored: p.commissionStored,
      currency: p.currency,
    },
  };
}

/** En el piloto solo cobra el fotógrafo con su propio Mercado Pago (nunca el organizador de un evento). */
export function intlCollectorAllowed(collectorType: string): boolean {
  return collectorType === "PHOTOGRAPHER";
}
