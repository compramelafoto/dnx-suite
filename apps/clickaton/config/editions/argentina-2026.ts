/**
 * Configuración canónica de la primera edición comercial.
 * Fuente de verdad de fechas/slug para seed y admin — no hardcodear en UI.
 *
 * Estado inicial seguro: DRAFT, no publicada, inscripciones deshabilitadas.
 */

/**
 * Talles canónicos Remera Clickatón (catálogo / seed).
 * No hardcodear solo en UI: el seed materializa variantes en Prisma.
 */
export const ARGENTINA_2026_SHIRT_SIZES = [
  { code: "XS", name: "XS", sortOrder: 10 },
  { code: "S", name: "S", sortOrder: 20 },
  { code: "M", name: "M", sortOrder: 30 },
  { code: "L", name: "L", sortOrder: 40 },
  { code: "XL", name: "XL", sortOrder: 50 },
  { code: "XXL", name: "XXL", sortOrder: 60 },
  { code: "XXXL", name: "XXXL", sortOrder: 70 },
] as const;

export const ARGENTINA_2026_MERCH = {
  productCode: "REMERA-CLICKATON",
  productName: "Remera Clickatón",
  productDescription:
    "Remera oficial Clickatón. Incluida según fase de precio; talle obligatorio cuando aplica.",
  ticketCode: "GENERAL",
  ticketName: "Inscripción general",
  /** Precio base del ticket (minor units); fases de precio pueden sobrescribir al cobrar. */
  ticketPricePesos: 25_000,
  includedQuantity: 1,
  /**
   * Stock placeholder alto: la arquitectura de holds existe, pero aún no hay
   * operación de inventario real. No simula agotamiento comercial.
   */
  placeholderStockPerSize: 10_000,
  /**
   * Fase 1 ($25.000) incluye remera. Fase 2 queda configurable en admin (seed no asume).
   * Fase 3 no incluye remera inicialmente.
   */
  includeShirtInPhaseAmountPesos: [25_000] as readonly number[],
  /**
   * First-N benefit: primeros N CONFIRMED (o PENDING con hold) reciben remera.
   * No es capacidad total de la edición/fase — N+1 puede inscribirse sin el beneficio.
   */
  firstNBenefitLimit: 100,
  storeSlug: "remera-clickaton",
  storeTitle: "Remera Clickatón",
  storeDescription: "Remera oficial — disponible próximamente en la tienda Clickatón.",
  /** Prep tienda: precio independiente (no abre storefront). */
  storePricePesos: 18_000,
} as const;

export const CLICKATON_ARGENTINA_2026 = {
  slug: "clickaton-argentina-2026",
  name: "Clickatón Argentina 2026",
  shortDescription:
    "Primera edición nacional de Clickatón. Inscripciones configurables desde administración.",
  description:
    "Clickatón Argentina 2026 — maratón fotográfica. Fecha oficial del evento: 19 de septiembre de 2026 (Argentina).",
  /** Día del evento en America/Argentina/Cordoba (UTC-3, sin DST). */
  eventDateLocal: "2026-09-19",
  timezone: "America/Argentina/Cordoba",
  country: "AR",
  currency: "ARS",
  city: null as string | null,
  provinceOrState: null as string | null,
  location: "Argentina",
  status: "DRAFT" as const,
  isPublished: false,
  registrationEnabled: false,
  visibleCodePrefix: "CKA26",
} as const;

/** Inicio del día del evento en TZ Argentina (ISO offset fijo -03:00). */
export function argentina2026EventStartAt(): Date {
  return new Date("2026-09-19T09:00:00-03:00");
}

/** Fin del día del evento (mismo día). */
export function argentina2026EventEndAt(): Date {
  return new Date("2026-09-19T20:00:00-03:00");
}
