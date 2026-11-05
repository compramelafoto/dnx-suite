/** Código de país ISO 3166-1 alfa-2, en mayúsculas. */
export type CountryCode = string;

/** Medio por el que el fotógrafo cobra sus ventas. */
export type CollectionProvider = "MERCADOPAGO_AR_SPLIT" | "MERCADOPAGO_OWN" | "PAYPAL_OWN";

export type SupportedCountry = {
  code: CountryCode;
  name: string;
  currency: string;
  provider: CollectionProvider;
};

const c = (
  code: string,
  name: string,
  currency: string,
  provider: CollectionProvider,
): SupportedCountry => ({ code, name, currency, provider });

const MP = "MERCADOPAGO_OWN" as const;
const PP = "PAYPAL_OWN" as const;

/** Países habilitados. Argentina primero, el resto en orden alfabético por nombre. */
export const SUPPORTED_COUNTRIES: readonly SupportedCountry[] = [
  c("AR", "Argentina", "ARS", "MERCADOPAGO_AR_SPLIT"),
  c("DE", "Alemania", "EUR", PP),
  c("BO", "Bolivia", "USD", PP),
  c("BR", "Brasil", "BRL", MP),
  c("CA", "Canadá", "CAD", PP),
  c("CL", "Chile", "CLP", MP),
  c("CO", "Colombia", "COP", MP),
  c("CR", "Costa Rica", "USD", PP),
  c("CU", "Cuba", "USD", PP),
  c("EC", "Ecuador", "USD", PP),
  c("SV", "El Salvador", "USD", PP),
  c("ES", "España", "EUR", PP),
  c("US", "Estados Unidos", "USD", PP),
  c("FR", "Francia", "EUR", PP),
  c("GT", "Guatemala", "USD", PP),
  c("HN", "Honduras", "USD", PP),
  c("IT", "Italia", "EUR", PP),
  c("MX", "México", "MXN", MP),
  c("NI", "Nicaragua", "USD", PP),
  c("PA", "Panamá", "USD", PP),
  c("PY", "Paraguay", "USD", PP),
  c("PE", "Perú", "PEN", MP),
  c("PT", "Portugal", "EUR", PP),
  c("GB", "Reino Unido", "GBP", PP),
  c("DO", "República Dominicana", "USD", PP),
  c("UY", "Uruguay", "UYU", MP),
  c("VE", "Venezuela", "USD", PP),
];

/** Alias en inglés (ya normalizados) que apuntan a un código. */
const ALIASES: Record<string, CountryCode> = {
  mexico: "MX",
  peru: "PE",
  brazil: "BR",
  spain: "ES",
  "united states": "US",
  usa: "US",
  uk: "GB",
};

/** Minúsculas, sin tildes y sin espacios en los extremos. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function getCountry(code: string | null | undefined): SupportedCountry | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return SUPPORTED_COUNTRIES.find((country) => country.code === upper) ?? null;
}

/** Convierte texto libre ("México", "mx") en código de país. No adivina: si no coincide, null. */
export function normalizeCountryInput(text: string | null | undefined): CountryCode | null {
  if (!text) return null;
  const key = fold(text);
  if (!key) return null;
  const match = SUPPORTED_COUNTRIES.find(
    (country) => fold(country.code) === key || fold(country.name) === key,
  );
  if (match) return match.code;
  return ALIASES[key] ?? null;
}

/** Moneda del país; sin país se asume ARS (comportamiento actual de CLF). */
export function currencyForCountry(code: CountryCode | null): string {
  return getCountry(code)?.currency ?? "ARS";
}

/** Verdadero para cualquier país distinto de Argentina; sin país, falso. */
export function isInternationalCountry(code: CountryCode | null): boolean {
  const country = getCountry(code);
  return country !== null && country.code !== "AR";
}
