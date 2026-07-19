import { parseQuoteItemHours } from "./quote-items";
import type {
  CuantoCobroClientHoursInput,
  CuantoCobroClientInput,
  CuantoCobroQuoteInput,
  CuantoCobroQuoteItem,
} from "./types";

export type QuoteHoursNormalizationResult = {
  quote: CuantoCobroQuoteInput;
  warnings: string[];
};

function mergeHoursField(existing: string, add: number): string {
  if (add <= 0) return existing;
  const total = parseQuoteItemHours(existing) + add;
  const rounded = Math.round(total * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function normalizeConceptCommercialHours(
  concept: CuantoCobroQuoteItem,
  clientHours: CuantoCobroClientHoursInput,
  warnings: string[],
): { concept: CuantoCobroQuoteItem; clientHours: CuantoCobroClientHoursInput } {
  if (concept.itemType !== "own-service") {
    return { concept, clientHours };
  }

  const label = concept.name.trim() || "Producto o servicio sin nombre";
  let nextConcept = { ...concept };
  let nextClientHours = { ...clientHours };

  const sales = parseQuoteItemHours(concept.salesHours);
  if (sales > 0) {
    nextClientHours = {
      ...nextClientHours,
      salesHours: mergeHoursField(nextClientHours.salesHours, sales),
    };
    nextConcept = { ...nextConcept, salesHours: "" };
    warnings.push(
      `Se movieron ${sales} h de ventas del producto o servicio «${label}» al bloque Cliente para evitar duplicar costos.`,
    );
  }

  const administration = parseQuoteItemHours(concept.administrationHours);
  if (administration > 0) {
    nextClientHours = {
      ...nextClientHours,
      coordinationHours: mergeHoursField(nextClientHours.coordinationHours, administration),
    };
    nextConcept = { ...nextConcept, administrationHours: "" };
    warnings.push(
      `Se movieron ${administration} h de administración del producto o servicio «${label}» al bloque Cliente (coordinación).`,
    );
  }

  const delivery = parseQuoteItemHours(concept.deliveryHours);
  const hadCommercialBundle = sales > 0 || administration > 0;
  if (delivery > 0 && hadCommercialBundle) {
    nextClientHours = {
      ...nextClientHours,
      administrativeDeliveryHours: mergeHoursField(nextClientHours.administrativeDeliveryHours, delivery),
    };
    nextConcept = { ...nextConcept, deliveryHours: "" };
    warnings.push(
      `Se movieron ${delivery} h de entrega del producto o servicio «${label}» al bloque Cliente (entrega administrativa). Si era entrega de material, cargala de nuevo en la línea.`,
    );
  }

  return { concept: nextConcept, clientHours: nextClientHours };
}

/**
 * Normaliza horas comerciales de conceptos → cliente solo en memoria (no persiste en sessionStorage).
 * Tras normalizar, los conceptos own-service no conservan salesHours ni administrationHours.
 */
export function normalizeQuoteHoursForCalculation(quote: CuantoCobroQuoteInput): QuoteHoursNormalizationResult {
  const warnings: string[] = [];
  let clientHours = { ...quote.client.hours };

  const concepts = quote.concepts.map((concept) => {
    const normalized = normalizeConceptCommercialHours(concept, clientHours, warnings);
    clientHours = normalized.clientHours;
    return normalized.concept;
  });

  const client: CuantoCobroClientInput = {
    ...quote.client,
    hours: clientHours,
  };

  return {
    quote: {
      ...quote,
      client,
      concepts,
    },
    warnings,
  };
}

/** Horas editables en la UI de servicio propio (postproducción incluye selección y exportación). */
export const CONCEPT_OWN_SERVICE_UI_HOUR_FIELDS = [
  "coverageHours",
  "editingHours",
  "travelHours",
  "deliveryHours",
] as const;

export type ConceptOwnServiceUiHourField = (typeof CONCEPT_OWN_SERVICE_UI_HOUR_FIELDS)[number];

/** Horas de servicio propio en conceptos (incluye `selectionHours` legacy para cálculo y migración). */
export const CONCEPT_OWN_SERVICE_HOUR_FIELDS = [
  ...CONCEPT_OWN_SERVICE_UI_HOUR_FIELDS,
  "selectionHours",
] as const;

export type ConceptOwnServiceHourField = (typeof CONCEPT_OWN_SERVICE_HOUR_FIELDS)[number];

/** @deprecated Horas comerciales — solo existen en datos legacy; se migran al cliente. */
export const LEGACY_CONCEPT_COMMERCIAL_HOUR_FIELDS = ["salesHours", "administrationHours"] as const;

export function sumConceptOwnServiceHours(item: CuantoCobroQuoteItem): number {
  if (item.itemType !== "own-service") return 0;
  return CONCEPT_OWN_SERVICE_UI_HOUR_FIELDS.reduce((total, field) => {
    if (field === "editingHours") {
      return (
        total + parseQuoteItemHours(item.editingHours) + parseQuoteItemHours(item.selectionHours)
      );
    }
    return total + parseQuoteItemHours(item[field]);
  }, 0);
}

export function conceptHasLegacyCommercialHours(item: CuantoCobroQuoteItem): boolean {
  if (item.itemType !== "own-service") return false;
  return LEGACY_CONCEPT_COMMERCIAL_HOUR_FIELDS.some((field) => parseQuoteItemHours(item[field]) > 0);
}
