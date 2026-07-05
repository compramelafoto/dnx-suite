/**
 * Contrato JSON entre API `/preventa-terms` y el modal de términos (pre-venta).
 * Permite párrafos, listas, destacados y tarjetas por pack/producto.
 */

export type TermsHighlightTone = "amber" | "slate" | "brand";

export type TermsPackItemCard = {
  /** Título visible (ej. «Fotos en formato digital») */
  title: string;
  /** Ej. «10 unidades» */
  quantityLabel: string;
  /** Líneas de detalle; lectura corta */
  lines: string[];
};

export type TermsPackBlock = {
  kind: "packBlock";
  packName: string;
  priceLabel: string;
  intro?: string;
  validityLines?: string[];
  items: TermsPackItemCard[];
};

export type TermsLegacyProductCard = {
  name: string;
  priceLabel: string;
  lines: string[];
};

/** Filas tipo tabla para resúmenes de precios y fechas (términos preventa). */
export type TermsPriceListBlock = {
  kind: "priceList";
  title: string;
  subtitle?: string;
  rows: { label: string; value: string; hint?: string }[];
};

export type TermsContentBlock =
  | { kind: "paragraphs"; paragraphs: string[] }
  | { kind: "bullets"; items: string[] }
  | {
      kind: "highlight";
      tone: TermsHighlightTone;
      title?: string;
      paragraphs: string[];
    }
  | TermsPackBlock
  | { kind: "legacyProducts"; products: TermsLegacyProductCard[] }
  | TermsPriceListBlock;

export type PreventaTermsSectionDoc = {
  id: string;
  title: string;
  blocks: TermsContentBlock[];
};
