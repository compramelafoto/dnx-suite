export type DefaultEconomicIndexType = "inflation" | "interest_rate";

/** Índice sugerido por defecto al consultar tasas para cuotas (por país). */
export function resolveDefaultEconomicIndexType(countryCode: string): DefaultEconomicIndexType {
  const normalized = (countryCode ?? "").trim().toLowerCase();
  if (normalized === "ar" || normalized === "argentina" || normalized === "ars") {
    return "inflation";
  }
  return "interest_rate";
}
