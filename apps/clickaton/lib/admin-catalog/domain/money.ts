import { CatalogValidationError } from "./errors";
import type { CatalogCurrency, MinorUnits } from "./types";

const ALLOWED: readonly CatalogCurrency[] = ["ARS"];

/** Rechaza floats y strings no enteros. Acepta number entero o string de dígitos. */
export function parseMinorUnits(
  value: unknown,
  field = "priceAmount",
): MinorUnits {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || !Number.isFinite(value)) {
      throw new CatalogValidationError({
        [field]: "El importe debe ser un entero en centavos (sin decimales).",
      });
    }
    if (value < 0) {
      throw new CatalogValidationError({ [field]: "El importe no puede ser negativo." });
    }
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new CatalogValidationError({
        [field]: "El importe debe ser un entero en centavos.",
      });
    }
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new CatalogValidationError({ [field]: "Importe inválido." });
    }
    return n;
  }
  throw new CatalogValidationError({ [field]: "Importe requerido." });
}

export function parseOptionalMinorUnits(
  value: unknown,
  field = "priceAmount",
): MinorUnits | null {
  if (value === null || value === undefined || value === "") return null;
  return parseMinorUnits(value, field);
}

export function normalizeCurrency(value: unknown, field = "currency"): CatalogCurrency {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "ARS";
  if (!(ALLOWED as readonly string[]).includes(raw)) {
    throw new CatalogValidationError({ [field]: "Moneda no soportada (MVP: ARS)." });
  }
  return raw as CatalogCurrency;
}

/** Display: "$ 40.000 ARS" */
export function formatArsDisplay(minor: MinorUnits, currency: CatalogCurrency = "ARS"): string {
  const major = minor / 100;
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(major);
  return `$ ${formatted} ${currency}`;
}
