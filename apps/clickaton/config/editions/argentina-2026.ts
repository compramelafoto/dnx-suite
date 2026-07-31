/**
 * Configuración canónica de la primera edición comercial.
 * Fuente de verdad de fechas/slug para seed y admin — no hardcodear en UI.
 *
 * Estado inicial seguro: DRAFT, no publicada, inscripciones deshabilitadas.
 */

/**
 * Talles canónicos Remera Clickatón (catálogo / seed).
 * Alineados a la Tabla de talles oficial (columnas 2–10):
 * XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL.
 * No hardcodear solo en UI: el seed materializa variantes en Prisma.
 */
export const ARGENTINA_2026_SHIRT_SIZES = [
  { code: "XS", name: "XS", sortOrder: 10, tableColumn: 2 },
  { code: "S", name: "S", sortOrder: 20, tableColumn: 3 },
  { code: "M", name: "M", sortOrder: 30, tableColumn: 4 },
  { code: "L", name: "L", sortOrder: 40, tableColumn: 5 },
  { code: "XL", name: "XL", sortOrder: 50, tableColumn: 6 },
  { code: "XXL", name: "XXL", sortOrder: 60, tableColumn: 7 },
  /** Columna 8 de la tabla (= 3XL). Code legado XXXL se mantiene por SKU/compat. */
  { code: "XXXL", name: "3XL", sortOrder: 70, tableColumn: 8 },
  { code: "4XL", name: "4XL", sortOrder: 80, tableColumn: 9 },
  { code: "5XL", name: "5XL", sortOrder: 90, tableColumn: 10 },
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
   * Fases cuyo precio seed incluye remera (beneficio first-N + deadline).
   * Fase 3 ($35k) empieza 06/09 > 30/08 → sin remera en seed.
   * El cutoff real del beneficio es `benefitDeadlineIso`, no el fin de fase.
   */
  includeShirtInPhaseAmountPesos: [25_000, 30_000] as readonly number[],
  /**
   * First-N benefit: primeros N CONFIRMED con confirmedAt ≤ deadline reciben remera.
   * PENDING+hold solo reserva soft el cupo (anti-oversell); no es consumidor definitivo.
   * No es capacidad total de la edición/fase — N+1 puede inscribirse sin el beneficio.
   */
  firstNBenefitLimit: 100,
  /**
   * Cierre temporal del beneficio (fin de día AR).
   * Independiente de las ventanas de precio/fase.
   */
  benefitDeadlineIso: "2026-08-30T23:59:59.999-03:00",
  benefitTimezone: "America/Argentina/Buenos_Aires",
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
