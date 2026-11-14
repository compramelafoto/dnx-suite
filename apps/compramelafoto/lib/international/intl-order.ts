import { INTL_COMMISSION_PERCENT } from "./pilot";

export const INTL_SNAPSHOT_KEY = "intlV1";

/** Un álbum en otra moneda que no sea pesos va por el camino internacional. Vacío = pesos. */
export function shouldUseIntlFlow(albumCurrency: string | null | undefined): boolean {
  const c = (albumCurrency ?? "").trim();
  return c !== "" && c !== "ARS";
}

/** Precio del fotógrafo + 15 % de comisión, en la unidad guardada de la moneda. */
export function computeIntlDigitalTotals(params: { unitPriceStored: number; photoCount: number }): {
  subtotalStored: number;
  commissionStored: number;
  totalStored: number;
} {
  const subtotalStored = params.unitPriceStored * params.photoCount;
  const commissionStored = Math.round((subtotalStored * INTL_COMMISSION_PERCENT) / 100);
  return { subtotalStored, commissionStored, totalStored: subtotalStored + commissionStored };
}

export type IntlSaleBlock =
  | "NOT_PILOT"
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
}): { ok: true } | { ok: false; block: IntlSaleBlock } {
  if (!input.pilot) return { ok: false, block: "NOT_PILOT" };
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
