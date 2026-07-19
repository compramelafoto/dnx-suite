import {
  CONCEPT_OWN_SERVICE_UI_HOUR_FIELDS,
  type ConceptOwnServiceUiHourField,
} from "./normalize-quote-hours";
import { parseQuoteItemHours, consolidateOwnServicePostProductionHours } from "./quote-items";
import type { CuantoCobroQuoteItem } from "./types";

/** Horas editables en conceptos de servicio propio (sin `selectionHours` legacy). */
export const QUOTE_ITEM_OWN_HOUR_FIELDS = CONCEPT_OWN_SERVICE_UI_HOUR_FIELDS;

export type QuoteItemOwnHourField = ConceptOwnServiceUiHourField;

export const QUOTE_ITEM_OWN_HOUR_LABELS: Record<QuoteItemOwnHourField, string> = {
  coverageHours: "Cobertura / evento",
  editingHours: "Postproducción",
  travelHours: "Traslado / viaje",
  deliveryHours: "Entrega de material",
};

export const QUOTE_ITEM_OWN_HOUR_HINTS: Partial<Record<QuoteItemOwnHourField, string>> = {
  coverageHours: "Tiempo en el lugar sacando fotos o grabando.",
  editingHours:
    "Edición, selección de fotos, backups y exportación de este producto o servicio.",
  travelHours: "Ida y vuelta vinculada a este ítem.",
  deliveryHours:
    "Entrega del material (galería, USB, álbum). La gestión administrativa va en el paso Cliente.",
};

/** Horas de postproducción (edición + selección/exportación legacy). */
export function getOwnServicePostProductionHours(item: CuantoCobroQuoteItem): number {
  return parseQuoteItemHours(item.editingHours) + parseQuoteItemHours(item.selectionHours);
}

export { consolidateOwnServicePostProductionHours } from "./quote-items";

/** Horas propias del ítem (excluye ventas/administración legacy). */
export function sumOwnServiceHours(item: CuantoCobroQuoteItem): number {
  if (item.itemType !== "own-service") return 0;
  return (
    parseQuoteItemHours(item.coverageHours) +
    getOwnServicePostProductionHours(item) +
    parseQuoteItemHours(item.travelHours) +
    parseQuoteItemHours(item.deliveryHours)
  );
}

/** Incluye horas legacy comerciales aún guardadas en el concepto (solo validación). */
export function sumOwnServiceHoursIncludingLegacy(item: CuantoCobroQuoteItem): number {
  if (item.itemType !== "own-service") return 0;
  const legacy =
    parseQuoteItemHours(item.salesHours) + parseQuoteItemHours(item.administrationHours);
  return sumOwnServiceHours(item) + legacy;
}

export function getOwnServiceHoursForField(item: CuantoCobroQuoteItem, field: QuoteItemOwnHourField): number {
  if (field === "editingHours") return getOwnServicePostProductionHours(item);
  return parseQuoteItemHours(item[field]);
}
