import type { CuantoCobroClientInput, CuantoCobroQuoteInput, CuantoCobroQuoteItem } from "@/lib/cuantocobro/types";

/** Líneas del presupuesto (alias interno: `quote.concepts`). */
export function getQuoteConcepts(quote: CuantoCobroQuoteInput): CuantoCobroQuoteItem[] {
  return quote.concepts;
}

export function getQuoteClient(quote: CuantoCobroQuoteInput): CuantoCobroClientInput {
  return quote.client;
}

/** Etiquetas de tipo para UI comercial. */
export const PRODUCT_SERVICE_TYPE_LABELS = {
  "own-service": "Servicio propio",
  "physical-product": "Producto físico",
  outsourced: "Servicio tercerizado",
  expense: "Gasto / viático",
} as const;

/** @deprecated Usar PRODUCT_SERVICE_TYPE_LABELS */
export const CONCEPT_TYPE_LABELS = PRODUCT_SERVICE_TYPE_LABELS;
