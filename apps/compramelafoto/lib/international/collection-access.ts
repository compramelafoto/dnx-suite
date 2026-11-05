import { getCountry, isInternationalCountry } from "./countries";
import { countryMismatchMessage } from "./collection-check";
import type { IntlCollectionProvider } from "./collection-secret";

export type CollectionAccess =
  | { available: false }
  | { available: true; provider: IntlCollectionProvider; countryCode: string; countryName: string };

export type CollectionAccountView = {
  provider: IntlCollectionProvider;
  secretLast4: string;
  accountLabel: string | null;
  accountCountryCode: string | null;
  connectedAt: string;
  lastCheckedAt: string | null;
  warning: string | null;
};

const PROVIDER_NAMES: Record<IntlCollectionProvider, string> = {
  MERCADOPAGO_OWN: "Mercado Pago",
  PAYPAL_OWN: "PayPal",
};

/** Disponible solo con el interruptor encendido y un país internacional (no Argentina). */
export function resolveCollectionAccess(input: {
  enabled: boolean;
  countryCode: string | null;
}): CollectionAccess {
  if (!input.enabled || !isInternationalCountry(input.countryCode)) return { available: false };
  const country = getCountry(input.countryCode);
  if (!country || country.provider === "MERCADOPAGO_AR_SPLIT") return { available: false };
  return {
    available: true,
    provider: country.provider,
    countryCode: country.code,
    countryName: country.name,
  };
}

function toProvider(value: string): IntlCollectionProvider {
  return value === "PAYPAL_OWN" ? "PAYPAL_OWN" : "MERCADOPAGO_OWN";
}

/** Vista que puede salir por la API: sin secretos ni id de credencial. */
export function toCollectionAccountView(
  row: {
    provider: string;
    secretLast4: string;
    accountLabel: string | null;
    accountCountryCode: string | null;
    connectedAt: Date;
    lastCheckedAt: Date | null;
  },
  access: Extract<CollectionAccess, { available: true }>,
): CollectionAccountView {
  const provider = toProvider(row.provider);
  const warning =
    row.provider !== access.provider
      ? `La cuenta conectada es de ${PROVIDER_NAMES[provider]} y no corresponde a ${access.countryName}. Conectá la cuenta correcta.`
      : countryMismatchMessage(access.countryCode, row.accountCountryCode);
  return {
    provider,
    secretLast4: row.secretLast4,
    accountLabel: row.accountLabel,
    accountCountryCode: row.accountCountryCode,
    connectedAt: row.connectedAt.toISOString(),
    lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
    warning,
  };
}
