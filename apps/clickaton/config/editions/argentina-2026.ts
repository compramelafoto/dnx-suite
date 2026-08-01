/**
 * Configuración canónica Clickatón Argentina 2026 (Bases / 10G.3 Schedule V2).
 * Fuente de verdad de fechas, ventanas y reglas de negocio por edición.
 * No hardcodear en UI; admin puede sobrescribir vía DB cuando exista rulesConfig.
 *
 * Estado inicial seguro: DRAFT, no publicada, inscripciones deshabilitadas.
 */

/**
 * Talles canónicos Remera Clickatón (catálogo / seed).
 * Alineados a la Tabla de talles oficial (columnas 2–10):
 * XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL.
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
  ticketPricePesos: 25_000,
  includedQuantity: 1,
  placeholderStockPerSize: 10_000,
  includeShirtInPhaseAmountPesos: [25_000, 30_000] as readonly number[],
  firstNBenefitLimit: 100,
  benefitDeadlineIso: "2026-08-30T23:59:59.999-03:00",
  benefitTimezone: "America/Argentina/Buenos_Aires",
  storeSlug: "remera-clickaton",
  storeTitle: "Remera Clickatón",
  storeDescription: "Remera oficial — disponible próximamente en la tienda Clickatón.",
  storePricePesos: 18_000,
} as const;

/** Timezone canónico Bases 2026 (UTC−3, sin DST). */
export const ARGENTINA_2026_TIMEZONE = "America/Argentina/Buenos_Aires" as const;

/** Versión histórica (audit trail; no usar en nuevas aceptaciones). */
export const CLICKATON_TERMS_VERSION_V1 = "CLICKATON_TERMS_2026_09_19_v1" as const;

/** Versión activa Schedule V2 (cronograma captura/upload 16–20 / 16–22). */
export const CLICKATON_TERMS_VERSION = "CLICKATON_TERMS_2026_09_19_v2" as const;

/**
 * Advertencia visible antes de consignas / upload.
 * No afirma corrección automática posterior.
 */
export const CAMERA_CLOCK_WARNING_ES =
  "IMPORTANTE: verificá ahora la fecha y hora de tu cámara o celular. Las fotografías válidas deben haber sido tomadas entre las 16:00 y las 20:00. La organización podrá verificar el horario mediante los metadatos de cada archivo." as const;

export const CAPTURE_CLOSED_UPLOAD_OPEN_MESSAGE_ES =
  "Finalizó el tiempo para tomar fotografías. Tenés hasta las 22:00 para seleccionar, revelar y subir las fotografías tomadas entre las 16:00 y las 20:00." as const;

export const UPLOAD_CLOSED_MESSAGE_ES =
  "Finalizó el período de entrega de fotografías." as const;

/**
 * Horarios oficiales del día del evento (offset fijo −03:00). America/Argentina/Buenos_Aires.
 *
 * Contrato técnico (10G.3):
 * - captureStart inclusive / captureEndExclusive
 * - uploadStart inclusive / uploadEndExclusive
 * - CAPTURE VALID: capturedAt >= 16:00:00 AND capturedAt < 20:00:00
 * - UPLOAD VALID:  uploadedAt >= 16:00:00 AND uploadedAt < 22:00:00
 * - La hora de upload NUNCA valida la captura (usar EXIF DateTimeOriginal u otra metadata canónica).
 */
export const ARGENTINA_2026_SCHEDULE = {
  eventDateLocal: "2026-09-19",
  timezone: ARGENTINA_2026_TIMEZONE,
  accreditationOpenIso: "2026-09-19T14:00:00.000-03:00",
  accreditationCloseIso: "2026-09-19T16:00:00.000-03:00",
  talkOpenIso: "2026-09-19T16:00:00.000-03:00",
  talkCloseIso: "2026-09-19T16:30:00.000-03:00",
  /** Inicio oficial: consignas + captura + upload. */
  marathonStartIso: "2026-09-19T16:00:00.000-03:00",
  promptsRevealIso: "2026-09-19T16:00:00.000-03:00",
  /** captureStart (inclusive). */
  captureOpenIso: "2026-09-19T16:00:00.000-03:00",
  /** captureEndExclusive — a las 20:00:00.000 ya es CAPTURE INVALID. */
  captureCloseIso: "2026-09-19T20:00:00.000-03:00",
  /** uploadStart (inclusive). */
  uploadOpenIso: "2026-09-19T16:00:00.000-03:00",
  /** uploadEndExclusive — a las 22:00:00.000 se rechaza server-side. */
  uploadCloseIso: "2026-09-19T22:00:00.000-03:00",
  /** Fin operativo del día (cierre de entrega). */
  marathonEndIso: "2026-09-19T22:00:00.000-03:00",
} as const;

export const ARGENTINA_2026_RULES = {
  termsVersion: CLICKATON_TERMS_VERSION,
  totalPrompts: 10,
  maxPhotosPerPrompt: 1,
  allowCrossPromptDuplicate: false,
  competitiveMinValidPrompts: 8,
  finalistsPerPrompt: 3,
  maxFinalists: 30,
  winnersPerPrompt: 1,
  socialVotingHours: 72,
  juryCriteria: [
    { key: "prompt_fit", label: "Adecuación a la consigna", min: 1, max: 10 },
    { key: "composition_technique", label: "Composición y técnica", min: 1, max: 10 },
    { key: "creativity_originality", label: "Creatividad y originalidad", min: 1, max: 10 },
    { key: "visual_impact", label: "Impacto visual / narrativa", min: 1, max: 10 },
  ] as const,
  editAllowed: [
    "exposure",
    "contrast",
    "color",
    "white_balance",
    "black_and_white",
    "crop",
    "conventional_develop",
  ] as const,
  editForbidden: [
    "photomontage",
    "ai_generation",
    "generative_fill",
    "generative_incorporation",
    "generative_substitution",
    "substantial_generative_removal",
    "generative_expansion",
  ] as const,
  reviewFlagAiOrManipulation: "AI_OR_MANIPULATION_SUSPECTED" as const,
  rawOptionalByDefault: true,
  promotionalLicense: {
    type: "PROMOTIONAL_LICENSE" as const,
    exclusivity: "LICENSE_NON_EXCLUSIVE" as const,
    copyrightTransfer: false,
    duration: "INDEFINITE" as const,
  },
  commercialLicense: {
    type: "COMMERCIAL_LICENSE" as const,
    exclusivity: "LICENSE_NON_EXCLUSIVE" as const,
    copyrightTransfer: false,
    appliesTo: "FINALISTS_ONLY" as const,
    maxWorks: 30,
    startsAtIso: "2026-09-19T00:00:00.000-03:00",
    endsAtIso: "2027-09-19T23:59:59.999-03:00",
    months: 12,
  },
  photographerRoyaltyBps: 2000,
  royaltyExcludeOnly: ["shipping"] as const,
  collectiveProductRoyaltyBps: 0,
  royaltyAvailableBusinessDays: 15,
  prizeBundleCount: 10,
  prizeDeliveryDaysAfterEvent: 15,
  returningParticipantDays: 7,
  annualPassCredits: 4,
  annualPassConsumeEvent: "CONTEST_PROMPTS_ACCESSED" as const,
  individualTransferMax: 1,
  weatherAutoCancel: false,
  cameraClockWarningEs: CAMERA_CLOCK_WARNING_ES,
} as const;

export const CLICKATON_ARGENTINA_2026 = {
  slug: "clickaton-argentina-2026",
  name: "Clickatón Argentina 2026",
  shortDescription:
    "Primera edición nacional de Clickatón. Inscripciones configurables desde administración.",
  description:
    "Clickatón Argentina 2026 — maratón fotográfica. Fecha oficial del evento: 19 de septiembre de 2026 (Argentina).",
  eventDateLocal: ARGENTINA_2026_SCHEDULE.eventDateLocal,
  timezone: ARGENTINA_2026_TIMEZONE,
  country: "AR",
  currency: "ARS",
  city: null as string | null,
  provinceOrState: null as string | null,
  location: "Argentina",
  status: "DRAFT" as const,
  isPublished: false,
  registrationEnabled: false,
  visibleCodePrefix: "CKA26",
  rules: ARGENTINA_2026_RULES,
  schedule: ARGENTINA_2026_SCHEDULE,
} as const;

/** Inicio oficial / reveal / apertura captura+upload. */
export function argentina2026EventStartAt(): Date {
  return new Date(ARGENTINA_2026_SCHEDULE.marathonStartIso);
}

/** Cierre absoluto de entrega (upload end exclusive). */
export function argentina2026EventEndAt(): Date {
  return new Date(ARGENTINA_2026_SCHEDULE.marathonEndIso);
}

export function argentina2026UploadOpenAt(): Date {
  return new Date(ARGENTINA_2026_SCHEDULE.uploadOpenIso);
}

export function argentina2026UploadCloseAt(): Date {
  return new Date(ARGENTINA_2026_SCHEDULE.uploadCloseIso);
}

export function argentina2026CaptureOpenAt(): Date {
  return new Date(ARGENTINA_2026_SCHEDULE.captureOpenIso);
}

/** Boundary exclusive de captura (20:00). */
export function argentina2026CaptureCloseAt(): Date {
  return new Date(ARGENTINA_2026_SCHEDULE.captureCloseIso);
}
