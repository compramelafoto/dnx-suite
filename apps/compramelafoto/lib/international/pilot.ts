/**
 * Piloto de CLF internacional (diseño, sección 11): solo los fotógrafos de
 * `CLF_INTL_PILOT_USER_IDS` venden en su moneda con su Mercado Pago y saldo en dólares.
 */
export const PILOT_ENV_VAR = "CLF_INTL_PILOT_USER_IDS";

/** Comisión internacional, sumada al precio del fotógrafo. */
export const INTL_COMMISSION_PERCENT = 15;
/** Adelanto inicial (préstamo) en centavos de USD; se devuelve en la primera recarga. */
export const ADVANCE_USD_CENTS = 2500;
/** Recarga mínima, sin contar el adelanto. */
export const MIN_TOPUP_USD_CENTS = 1000;
/** Recarga máxima por operación (tope de seguridad). */
export const MAX_TOPUP_USD_CENTS = 100000;
/** Montos sugeridos de recarga. */
export const TOPUP_OPTIONS_USD_CENTS = [2500, 5000, 10000] as const;
/** Por debajo de este saldo se avisa al fotógrafo. */
export const LOW_BALANCE_USD_CENTS = 500;

export function parsePilotUserIds(raw: string | undefined): Set<number> {
  const ids = new Set<number>();
  for (const part of (raw ?? "").split(",")) {
    const n = Number(part.trim());
    if (part.trim() !== "" && Number.isInteger(n) && n > 0) ids.add(n);
  }
  return ids;
}

export function isIntlPilotUser(
  userId: number | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (userId == null) return false;
  return parsePilotUserIds(env[PILOT_ENV_VAR]).has(userId);
}

const MP_SITE_CURRENCY: Record<string, string> = {
  MLC: "CLP",
  MCO: "COP",
  MLM: "MXN",
  MPE: "PEN",
  MLU: "UYU",
  MLB: "BRL",
};

/** Moneda de una cuenta de Mercado Pago según su `site_id`. Argentina y desconocidos → null. */
export function currencyForMpSite(siteId: string | null | undefined): string | null {
  if (!siteId) return null;
  return MP_SITE_CURRENCY[siteId] ?? null;
}
