import type { CatalogDeliveryType } from "@/lib/prisma";

/** Modo de cantidad para componentes digitales en catálogo / plantillas. */
export type CatalogDigitalQuantityMode = "FIXED" | "ALL_EVENT_PHOTOS" | "ALL_MY_PHOTOS";

export const CATALOG_DIGITAL_QUANTITY_MODES: CatalogDigitalQuantityMode[] = [
  "FIXED",
  "ALL_EVENT_PHOTOS",
  "ALL_MY_PHOTOS",
];

export const CATALOG_DIGITAL_QUANTITY_MODE_LABELS: Record<CatalogDigitalQuantityMode, string> = {
  FIXED: "Cantidad fija",
  ALL_EVENT_PHOTOS: "Todas las fotos",
  ALL_MY_PHOTOS: "Todas mis fotos",
};

export const CATALOG_DIGITAL_QUANTITY_MODE_HELP: Record<
  Exclude<CatalogDigitalQuantityMode, "FIXED">,
  string
> = {
  ALL_EVENT_PHOTOS: "El cliente puede elegir de todas las fotos publicadas en el álbum.",
  ALL_MY_PHOTOS:
    "Solo las fotos donde aparece el cliente (reconocimiento facial / selfie en la galería).",
};

const NOTES_MODE_PREFIX = /^@digitalQty:(ALL_EVENT_PHOTOS|ALL_MY_PHOTOS)\n?/;

export function isDigitalDeliveryType(deliveryType: CatalogDeliveryType): boolean {
  return deliveryType === "DIGITAL";
}

export function parseDigitalQuantityMode(raw: unknown): CatalogDigitalQuantityMode {
  if (raw === "ALL_EVENT_PHOTOS" || raw === "ALL_MY_PHOTOS" || raw === "FIXED") {
    return raw;
  }
  return "FIXED";
}

export function stripDigitalQtyFromNotes(notes: string): string {
  return notes.replace(NOTES_MODE_PREFIX, "").trimStart();
}

export function parseDigitalQtyFromNotes(notes: string): CatalogDigitalQuantityMode {
  const match = notes.match(/^@digitalQty:(ALL_EVENT_PHOTOS|ALL_MY_PHOTOS)/);
  if (match) return match[1] as CatalogDigitalQuantityMode;
  return "FIXED";
}

export function encodeNotesWithDigitalQty(
  notes: string,
  mode: CatalogDigitalQuantityMode
): string {
  const clean = stripDigitalQtyFromNotes(notes);
  if (mode === "FIXED") return clean;
  const prefix = `@digitalQty:${mode}\n`;
  return clean ? `${prefix}${clean}` : prefix.trimEnd();
}

export function resolveDigitalQuantityMode(input: {
  deliveryType: CatalogDeliveryType;
  digitalQuantityMode?: CatalogDigitalQuantityMode | null;
  notes?: string;
}): CatalogDigitalQuantityMode {
  if (!isDigitalDeliveryType(input.deliveryType)) return "FIXED";
  if (input.digitalQuantityMode) return input.digitalQuantityMode;
  if (input.notes) return parseDigitalQtyFromNotes(input.notes);
  return "FIXED";
}

export function formatDigitalQuantitySummary(
  quantity: number,
  mode: CatalogDigitalQuantityMode,
  deliveryType: CatalogDeliveryType
): string | null {
  if (!isDigitalDeliveryType(deliveryType)) return null;
  if (mode === "ALL_EVENT_PHOTOS") return "Todas las fotos";
  if (mode === "ALL_MY_PHOTOS") return "Todas mis fotos";
  if (mode === "FIXED" && quantity > 0) return String(quantity);
  return null;
}

export function normalizeDigitalQuantityForStorage(
  quantity: number,
  mode: CatalogDigitalQuantityMode
): number {
  if (mode === "FIXED") return Math.max(1, Math.round(quantity));
  return 1;
}
