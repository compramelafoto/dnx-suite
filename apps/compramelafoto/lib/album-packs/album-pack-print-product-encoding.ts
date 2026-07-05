/** Metadato interno en `description` hasta persistir componentes en DB (Fase 1 backend). */
const PACK_PRINT_PRODUCT_PREFIX = /^@packPrintProduct:(\d+)\n?/;

export function parsePackPrintProductFromDescription(
  description: string | null | undefined
): number | null {
  if (!description) return null;
  const match = description.match(/^@packPrintProduct:(\d+)/);
  if (!match) return null;
  const id = Number.parseInt(match[1] ?? "", 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function stripPackPrintProductFromDescription(description: string | null | undefined): string {
  if (!description) return "";
  return description.replace(PACK_PRINT_PRODUCT_PREFIX, "").trimStart();
}

export function encodePackDescriptionWithPrintProduct(
  description: string,
  photographerProductId: number
): string {
  const clean = stripPackPrintProductFromDescription(description);
  const prefix = `@packPrintProduct:${photographerProductId}\n`;
  return clean ? `${prefix}${clean}` : prefix.trimEnd();
}
