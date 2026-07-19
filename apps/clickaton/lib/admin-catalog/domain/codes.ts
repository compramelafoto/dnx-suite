import { CatalogValidationError } from "./errors";

/** Normaliza a UPPER_SNAKE alfanumérico. */
export function normalizeCatalogCode(raw: string, field = "code"): string {
  const trimmed = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const cleaned = trimmed.replace(/[^A-Z0-9_]/g, "");
  if (!cleaned) {
    throw new CatalogValidationError({ [field]: "Código inválido." });
  }
  if (cleaned.length > 64) {
    throw new CatalogValidationError({ [field]: "Código demasiado largo." });
  }
  return cleaned;
}

export function normalizeSku(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed || trimmed.length > 80) {
    throw new CatalogValidationError({ sku: "SKU inválido." });
  }
  return trimmed;
}
