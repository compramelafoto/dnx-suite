import { CatalogValidationError } from "../domain/errors";
import { formatArsDisplay } from "../domain/money";
import type { CatalogCurrency, MinorUnits } from "../domain/types";

/**
 * Conversión UI → storage (ARS MVP):
 * - El admin ingresa pesos enteros: `40000`
 * - Se almacenan minor units: `40000 * 100 = 4_000_000`
 * - Display: `$ 40.000 ARS` vía formatArsDisplay(minor)
 *
 * No se aceptan decimales en el input humano del MVP.
 */
export function pesosInputToMinorUnits(
  value: unknown,
  field = "priceAmount",
): MinorUnits {
  if (value === null || value === undefined || value === "") {
    throw new CatalogValidationError({ [field]: "Importe requerido." });
  }
  const raw = typeof value === "number" ? String(value) : String(value).trim();
  // Permitir separador de miles opcional: 40.000 o 40,000 → 40000
  const digits = raw.replace(/[.\s]/g, "").replace(/,/g, "");
  if (!/^\d+$/.test(digits)) {
    throw new CatalogValidationError({
      [field]: "Ingresá pesos enteros (ej. 40000). Sin centavos en el MVP.",
    });
  }
  const pesos = Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(pesos) || pesos < 0) {
    throw new CatalogValidationError({ [field]: "Importe inválido." });
  }
  if (pesos > Number.MAX_SAFE_INTEGER / 100) {
    throw new CatalogValidationError({ [field]: "Importe demasiado grande." });
  }
  return pesos * 100;
}

export function optionalPesosInputToMinorUnits(
  value: unknown,
  field = "priceAmount",
): MinorUnits | null {
  if (value === null || value === undefined || value === "") return null;
  return pesosInputToMinorUnits(value, field);
}

/** Minor → string para input (pesos enteros). */
export function minorUnitsToPesosInput(minor: MinorUnits | null | undefined): string {
  if (minor == null) return "";
  return String(Math.trunc(minor / 100));
}

export function displayPrice(
  minor: MinorUnits | null | undefined,
  currency: CatalogCurrency | null = "ARS",
): string {
  if (minor == null) return "Sin precio adicional";
  if (minor === 0) return "Incluido / sin adicional";
  return formatArsDisplay(minor, currency ?? "ARS");
}

/** Precio de tipo de entrada (soporta gratis). */
export function displayTicketPrice(
  minor: MinorUnits,
  currency: CatalogCurrency = "ARS",
): string {
  if (minor === 0) return "Gratis";
  return formatArsDisplay(minor, currency);
}

/** Umbral visual documentado: stock disponible ≤ 5 → “poco stock”. */
export const LOW_STOCK_THRESHOLD = 5;

export function stockTone(
  available: number,
  isActive: boolean,
): "inactive" | "sold_out" | "low" | "ok" {
  if (!isActive) return "inactive";
  if (available <= 0) return "sold_out";
  if (available <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}
