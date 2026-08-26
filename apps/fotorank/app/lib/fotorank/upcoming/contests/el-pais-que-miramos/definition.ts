/**
 * "El País que Miramos" — Primera Edición 2026.
 *
 * Definición declarativa única, compartida por el seed idempotente y el
 * preview administrativo. Cambiar un dato acá lo cambia en los dos lugares.
 *
 * Estado obligatorio al cargarse: DRAFT. Nada de lo definido acá publica,
 * cobra ni envía por sí solo.
 */

import { contestLocalToUtc } from "../../../timezone/contest-windows";
import type { CommunicationAudience, CommunicationEventType } from "../../communications";
import type { PrizeGateSnapshot } from "../../publication-gates";
import { EL_PAIS_QUE_MIRAMOS_RULES_DRAFT, EL_PAIS_QUE_MIRAMOS_RULES_TITLE } from "./rules-draft";

export const CONTEST_SLUG = "el-pais-que-miramos-2026";
export const ORGANIZATION_SLUG = "fotorank";
export const TIMEZONE = "America/Argentina/Buenos_Aires";

/** Wall-clock local (sin zona) → instante UTC en la zona del concurso. */
export function local(isoLocal: string): Date {
  return contestLocalToUtc(isoLocal, TIMEZONE);
}

// ---------------------------------------------------------------------------
// Identidad
// ---------------------------------------------------------------------------

export const IDENTITY = {
  title: "El País que Miramos",
  tagline: "Ganá una cámara mirrorless",
  edition: "Primera edición 2026",
  contestType: "Concurso Nacional de Fotografía",
  organizerDisplayName: "FotoRank",
  scope: "República Argentina",
  cardSummary: "Abierto a fotógrafos profesionales y aficionados de todo el país.",
  /** Badge de la tarjeta pública cuando esté en UPCOMING. */
  cardBadge: "PRÓXIMAMENTE · CONCURSO NACIONAL",
} as const;

// ---------------------------------------------------------------------------
// Cronograma (hora de Argentina)
// ---------------------------------------------------------------------------

export const SCHEDULE = {
  /** Cierre de la captación de interesados con beneficio. */
  interestBenefitCutoffLocal: "2026-09-20T23:59:59",
  /** Apertura de inscripciones. */
  registrationOpensLocal: "2026-09-21T00:00:00",
  /** Fin del precio exclusivo para interesados. */
  promoPriceEndsLocal: "2026-10-10T23:59:59",
  /** Fin del precio de octubre. */
  octoberPriceEndsLocal: "2026-10-31T23:59:59",
  /** Fin del precio de noviembre. */
  novemberPriceEndsLocal: "2026-11-30T23:59:59",
  /** Cierre definitivo de inscripción y carga. */
  submissionsCloseLocal: "2026-12-05T23:59:59",
  admissionStartLocal: "2026-12-06T00:00:00",
  admissionEndLocal: "2026-12-08T23:59:59",
  judgingStartLocal: "2026-12-09T00:00:00",
  judgingEndLocal: "2026-12-15T23:59:59",
  deliberationStartLocal: "2026-12-16T00:00:00",
  deliberationEndLocal: "2026-12-17T23:59:59",
  finalistsNotifiedLocal: "2026-12-18T00:00:00",
  resultsLocal: "2026-12-21T00:00:00",
} as const;

export const SCHEDULE_UTC = {
  interestBenefitCutoffAt: local(SCHEDULE.interestBenefitCutoffLocal),
  registrationOpensAt: local(SCHEDULE.registrationOpensLocal),
  promoPriceEndsAt: local(SCHEDULE.promoPriceEndsLocal),
  octoberPriceEndsAt: local(SCHEDULE.octoberPriceEndsLocal),
  novemberPriceEndsAt: local(SCHEDULE.novemberPriceEndsLocal),
  submissionsCloseAt: local(SCHEDULE.submissionsCloseLocal),
  admissionStartAt: local(SCHEDULE.admissionStartLocal),
  admissionEndAt: local(SCHEDULE.admissionEndLocal),
  judgingStartAt: local(SCHEDULE.judgingStartLocal),
  judgingEndAt: local(SCHEDULE.judgingEndLocal),
  finalistsNotifiedAt: local(SCHEDULE.finalistsNotifiedLocal),
  resultsAt: local(SCHEDULE.resultsLocal),
};

// ---------------------------------------------------------------------------
// Participación
// ---------------------------------------------------------------------------

export const PARTICIPATION = {
  minAgeYears: 18,
  audience: "Fotógrafos profesionales y aficionados.",
  residency: "Argentinos o extranjeros residentes en Argentina.",
  territory: "Todo el territorio nacional.",
  requiresAssociationMembership: false,
  requiresProfessionalGear: false,
  allowsPhoneCapture: true,
  maxPhotosPerParticipant: 3,
} as const;

// ---------------------------------------------------------------------------
// Consigna
// ---------------------------------------------------------------------------

export const BRIEF = {
  title: "El País que Miramos",
  text: `El País que Miramos invita a fotógrafos profesionales y aficionados a construir un retrato amplio, diverso y contemporáneo de la Argentina.

Se buscan fotografías que expresen una mirada personal sobre el territorio argentino, sus personas, paisajes, ciudades, pueblos, costumbres, trabajos, vínculos, contrastes y transformaciones.

Podrán presentarse imágenes urbanas, rurales, documentales, paisajísticas, sociales, culturales, arquitectónicas, naturales y retratos, siempre que hayan sido realizadas en la República Argentina y mantengan una relación reconocible con la consigna.

No se busca únicamente perfección técnica. Se valorarán especialmente la capacidad narrativa, la sensibilidad, la originalidad y la mirada personal del autor.`,
  /** Todas las obras compiten por el mismo Gran Premio. */
  hasCompetitiveCategories: false,
  /** Etiquetas internas de curaduría; NO son categorías competitivas. */
  curatorialTagsAreCompetitive: false,
} as const;

// ---------------------------------------------------------------------------
// Criterios de evaluación (suman 100)
// ---------------------------------------------------------------------------

export const EVALUATION_CRITERIA = [
  { code: "narrativa", label: "Potencia narrativa y emocional", weightPercent: 30 },
  { code: "originalidad", label: "Originalidad y mirada personal", weightPercent: 25 },
  { code: "consigna", label: "Relación con la consigna", weightPercent: 20 },
  { code: "composicion", label: "Composición y construcción visual", weightPercent: 15 },
  { code: "tecnica", label: "Resolución técnica", weightPercent: 10 },
] as const;

/** Datos que el jurado NO puede ver durante la evaluación. */
export const JURY_BLINDED_FIELDS = [
  "Nombre del autor",
  "Correo",
  "Documento",
  "Provincia",
  "Instagram",
  "Paquete comprado",
  "Cantidad total de fotografías adquiridas",
  "Datos de pago",
  "Cualquier dato que permita identificar al autor",
] as const;

export const JURY_RULES = {
  anonymousEvaluation: true,
  /** Un participante puede presentar hasta 3 obras pero recibir un solo premio principal. */
  maxMainPrizesPerParticipant: 1,
} as const;

/** Posiciones de jurado pendientes. No se cargan jurados ficticios. */
export const JURY_POSITIONS = [
  { code: "jurado-1", label: "Jurado 1", profile: "Fotógrafo o fotógrafa de trayectoria" },
  { code: "jurado-2", label: "Jurado 2", profile: "Editor, curador, docente o gestor cultural" },
  { code: "jurado-3", label: "Jurado 3", profile: "Fotógrafo o referente de otra región del país" },
] as const;

export const JURY_PENDING_FLAG = "JURADOS PENDIENTES DE CONFIRMACIÓN";

// ---------------------------------------------------------------------------
// Premio
// ---------------------------------------------------------------------------

export const PRIZE_PENDING_FLAG = "MODELO DEL PREMIO PENDIENTE DE CONFIRMACIÓN";

export const PRIZE_PROVISIONAL_DESCRIPTION =
  "Una cámara mirrorless APS-C con lente kit, de prestaciones y valor equivalentes a una " +
  "Canon EOS R50, Sony A6400 o Nikon Z30.";

/**
 * Premio provisional. Todos los campos obligatorios quedan en null a propósito:
 * no se inventan. El gate REGISTRATION_OPEN los exige completos.
 */
export const PRIZE_SNAPSHOT: PrizeGateSnapshot = {
  brand: null,
  model: null,
  includedLens: null,
  isNewProduct: null,
  warranty: null,
  referenceValue: null,
  supplier: null,
  deliveryMethod: null,
  shippingResponsible: null,
  shippingCostCoverage: null,
  officialImageUrl: null,
  outOfStockAlternative: null,
  technicalSponsor: null,
  modelPendingConfirmation: true,
};

export const AWARDS = {
  grandPrize: {
    label: "Gran Premio",
    items: [
      "Cámara mirrorless APS-C con lente kit",
      "Diploma digital",
      "Entrevista o publicación en FotoRank",
      "Obra destacada en la galería",
    ],
    pendingConfirmation: true,
  },
  secondPrize: { label: "Segundo premio", status: "PENDIENTE DE SPONSOR O DEFINICIÓN" },
  thirdPrize: { label: "Tercer premio", status: "PENDIENTE DE SPONSOR O DEFINICIÓN" },
  mentions: {
    juryMentions: { max: 3, label: "Menciones del jurado" },
    publicChoice: {
      label: "Premio del Público",
      /** Independiente: no altera la evaluación del jurado ni el Gran Premio. */
      independentFromJury: true,
    },
    finalistsSelection: true,
    digitalGallery: true,
    certificates: ["Certificado de participación", "Certificado de finalista"],
  },
} as const;

// ---------------------------------------------------------------------------
// Precios (minor units = centavos de ARS)
// ---------------------------------------------------------------------------

export type PricePhaseDefinition = {
  code: string;
  name: string;
  description: string;
  audience: "INTEREST_EXCLUSIVE" | "GENERAL";
  startsAtLocal: string;
  endsAtLocal: string;
  priority: number;
  tiers: Array<{ quantity: number; amountMinor: number; label: string }>;
};

const ars = (pesos: number) => pesos * 100;

export const PRICE_PHASES: PricePhaseDefinition[] = [
  {
    code: "interest-exclusive",
    name: "Precio exclusivo para interesados",
    description:
      "Solo para usuarios que registraron interés hasta el 20/09/2026 23:59. Personal e intransferible.",
    audience: "INTEREST_EXCLUSIVE",
    startsAtLocal: SCHEDULE.registrationOpensLocal,
    endsAtLocal: SCHEDULE.promoPriceEndsLocal,
    // Menor prioridad numérica = gana frente a la fase general solapada.
    priority: 10,
    tiers: [
      { quantity: 1, amountMinor: ars(45_000), label: "Una fotografía" },
      { quantity: 2, amountMinor: ars(80_000), label: "Dos fotografías" },
      { quantity: 3, amountMinor: ars(100_000), label: "Tres fotografías" },
    ],
  },
  {
    code: "general-septiembre-octubre",
    name: "Precio general (21/09 al 10/10)",
    description:
      "Precio general vigente mientras corre el beneficio exclusivo, para quien no sea elegible.",
    audience: "GENERAL",
    startsAtLocal: SCHEDULE.registrationOpensLocal,
    endsAtLocal: SCHEDULE.promoPriceEndsLocal,
    priority: 100,
    tiers: [
      { quantity: 1, amountMinor: ars(50_000), label: "Una fotografía" },
      { quantity: 2, amountMinor: ars(90_000), label: "Dos fotografías" },
      { quantity: 3, amountMinor: ars(115_000), label: "Tres fotografías" },
    ],
  },
  {
    code: "octubre",
    name: "Precio general de octubre",
    description: "Del 11 al 31 de octubre de 2026.",
    audience: "GENERAL",
    startsAtLocal: "2026-10-11T00:00:00",
    endsAtLocal: SCHEDULE.octoberPriceEndsLocal,
    priority: 100,
    tiers: [
      { quantity: 1, amountMinor: ars(50_000), label: "Una fotografía" },
      { quantity: 2, amountMinor: ars(90_000), label: "Dos fotografías" },
      { quantity: 3, amountMinor: ars(115_000), label: "Tres fotografías" },
    ],
  },
  {
    code: "noviembre",
    name: "Precio de noviembre",
    description: "Del 1 al 30 de noviembre de 2026.",
    audience: "GENERAL",
    startsAtLocal: "2026-11-01T00:00:00",
    endsAtLocal: SCHEDULE.novemberPriceEndsLocal,
    priority: 100,
    tiers: [
      { quantity: 1, amountMinor: ars(60_000), label: "Una fotografía" },
      { quantity: 2, amountMinor: ars(105_000), label: "Dos fotografías" },
      { quantity: 3, amountMinor: ars(135_000), label: "Tres fotografías" },
    ],
  },
  {
    code: "diciembre",
    name: "Precio final de diciembre",
    description: "Del 1 al 5 de diciembre de 2026.",
    audience: "GENERAL",
    startsAtLocal: "2026-12-01T00:00:00",
    endsAtLocal: SCHEDULE.submissionsCloseLocal,
    priority: 100,
    tiers: [
      { quantity: 1, amountMinor: ars(70_000), label: "Una fotografía" },
      { quantity: 2, amountMinor: ars(120_000), label: "Dos fotografías" },
      { quantity: 3, amountMinor: ars(150_000), label: "Tres fotografías" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Calendario de comunicaciones (declarativo; no dispara envíos)
// ---------------------------------------------------------------------------

export type ScheduledCommunicationDefinition = {
  code: string;
  eventType: CommunicationEventType;
  subject: string;
  bodyOutline: string;
  /** null = disparada por evento, no por fecha. */
  scheduledLocal: string | null;
  category: "OPERATIONAL" | "PROMOTIONAL";
  audience: CommunicationAudience;
  blockedReason?: string;
};

export const SCHEDULED_COMMUNICATIONS: ScheduledCommunicationDefinition[] = [
  {
    code: "interest-confirmed",
    eventType: "INTEREST_CONFIRMED",
    subject: "Ya estás en la lista de El País que Miramos",
    bodyOutline:
      "Registramos tu interés correctamente. El concurso abrirá el 21 de septiembre de 2026 y, " +
      "por haberte anotado antes del lanzamiento, accederás a un precio promocional exclusivo. " +
      "Te avisaremos apenas se habiliten las inscripciones.",
    scheduledLocal: null,
    category: "PROMOTIONAL",
    audience: "INTEREST_SPECIFIC",
  },
  {
    code: "prelaunch-2026-09-14",
    eventType: "PRELAUNCH_REMINDER",
    subject: "Falta una semana para El País que Miramos",
    bodyOutline:
      "Recordar la apertura. Adelantar la consigna. Invitar a comenzar a seleccionar fotografías. " +
      "No afirmar un modelo de cámara definitivo mientras no esté confirmado.",
    scheduledLocal: "2026-09-14T10:00:00",
    category: "PROMOTIONAL",
    audience: "INTEREST_SPECIFIC",
  },
  {
    code: "prelaunch-2026-09-19",
    eventType: "PRELAUNCH_REMINDER",
    subject: "Después de Clickatón llega El País que Miramos",
    bodyOutline:
      "Conectar ambos acontecimientos. Recordar que abre el 21 de septiembre. Recordar el beneficio exclusivo. " +
      "NO enviar a participantes de Clickatón por el solo hecho de haber participado: se requiere " +
      "consentimiento específico de este concurso o consentimiento general vigente.",
    scheduledLocal: "2026-09-19T10:00:00",
    category: "PROMOTIONAL",
    audience: "INTEREST_SPECIFIC",
  },
  {
    code: "registration-opened-2026-09-21",
    eventType: "REGISTRATION_OPENED",
    subject: "Ya podés participar por una cámara mirrorless",
    bodyOutline:
      "Apertura. Consigna. Premio confirmado. Jurados confirmados. Precios. Fecha límite del precio " +
      "promocional. Botón de participación.",
    scheduledLocal: "2026-09-21T09:00:00",
    category: "PROMOTIONAL",
    audience: "INTEREST_SPECIFIC",
  },
  {
    code: "brief-detail-2026-09-28",
    eventType: "PROMO_PRICE_REMINDER",
    subject: "¿Qué fotografías pueden participar?",
    bodyOutline: "Detallar la consigna y los requisitos de admisión. Recordar el beneficio vigente.",
    scheduledLocal: "2026-09-28T10:00:00",
    category: "PROMOTIONAL",
    audience: "INTEREST_SPECIFIC",
  },
  {
    code: "promo-reminder-2026-10-05",
    eventType: "PROMO_PRICE_REMINDER",
    subject: "Últimos días para conservar tu precio exclusivo",
    bodyOutline: "Recordar la fecha límite del 10 de octubre para completar el pago.",
    scheduledLocal: "2026-10-05T10:00:00",
    category: "PROMOTIONAL",
    audience: "INTEREST_SPECIFIC",
  },
  {
    code: "promo-expiring-2026-10-09",
    eventType: "PROMO_PRICE_EXPIRING",
    subject: "Tu precio promocional vence mañana",
    bodyOutline: "Aviso de vencimiento a 24 horas.",
    scheduledLocal: "2026-10-09T10:00:00",
    category: "PROMOTIONAL",
    audience: "INTEREST_SPECIFIC",
  },
  {
    code: "promo-last-day-2026-10-10",
    eventType: "PROMO_PRICE_LAST_DAY",
    subject: "Hoy vence tu acceso promocional",
    bodyOutline: "Último día de vigencia del beneficio: vence a las 23:59 de Argentina.",
    scheduledLocal: "2026-10-10T09:00:00",
    category: "PROMOTIONAL",
    audience: "INTEREST_SPECIFIC",
  },
  {
    code: "general-open-2026-10-11",
    eventType: "PRICE_PHASE_STARTED",
    subject: "Inscripciones abiertas para todo el país",
    bodyOutline:
      "Correo general. Solo puede enviarse a usuarios con consentimiento general válido de FotoRank.",
    scheduledLocal: "2026-10-11T10:00:00",
    category: "PROMOTIONAL",
    audience: "GENERAL_OPT_IN",
  },
  {
    code: "price-change-2026-10-29",
    eventType: "PROMO_PRICE_EXPIRING",
    subject: "El precio de inscripción cambia en noviembre",
    bodyOutline: "Avisar el cierre de la etapa de octubre.",
    scheduledLocal: "2026-10-29T10:00:00",
    category: "PROMOTIONAL",
    audience: "GENERAL_OPT_IN",
  },
  {
    code: "price-phase-2026-11-01",
    eventType: "PRICE_PHASE_STARTED",
    subject: "Comenzó una nueva etapa de El País que Miramos",
    bodyOutline: "Comunicar el inicio de la etapa de noviembre.",
    scheduledLocal: "2026-11-01T10:00:00",
    category: "PROMOTIONAL",
    audience: "GENERAL_OPT_IN",
  },
  {
    code: "price-ending-2026-11-25",
    eventType: "PROMO_PRICE_EXPIRING",
    subject: "Últimos días del precio de noviembre",
    bodyOutline: "Recordar el cierre de la etapa de noviembre.",
    scheduledLocal: "2026-11-25T10:00:00",
    category: "PROMOTIONAL",
    audience: "GENERAL_OPT_IN",
  },
  {
    code: "final-phase-2026-11-30",
    eventType: "PROMO_PRICE_LAST_DAY",
    subject: "Mañana comienza la etapa final",
    bodyOutline: "Último día del precio de noviembre.",
    scheduledLocal: "2026-11-30T10:00:00",
    category: "PROMOTIONAL",
    audience: "GENERAL_OPT_IN",
  },
  {
    code: "final-phase-2026-12-01",
    eventType: "PRICE_PHASE_STARTED",
    subject: "Últimos cinco días para participar",
    bodyOutline: "Inicio de la etapa final de diciembre.",
    scheduledLocal: "2026-12-01T10:00:00",
    category: "PROMOTIONAL",
    audience: "GENERAL_OPT_IN",
  },
  {
    code: "closing-2026-12-04",
    eventType: "PROMO_PRICE_EXPIRING",
    subject: "Mañana cierra El País que Miramos",
    bodyOutline: "Aviso de cierre a 24 horas.",
    scheduledLocal: "2026-12-04T10:00:00",
    category: "PROMOTIONAL",
    audience: "GENERAL_OPT_IN",
  },
  {
    code: "closing-2026-12-05",
    eventType: "PROMO_PRICE_LAST_DAY",
    subject: "Últimas horas para cargar tu fotografía",
    bodyOutline: "Cierre definitivo a las 23:59 de Argentina.",
    scheduledLocal: "2026-12-05T09:00:00",
    category: "PROMOTIONAL",
    audience: "GENERAL_OPT_IN",
  },
];

/** Eventos preparados pero inoperantes hasta integrar DNX Payments. */
export const PAYMENT_DEPENDENT_COMMUNICATIONS: ScheduledCommunicationDefinition[] = [
  {
    code: "payment-confirmed",
    eventType: "PAYMENT_CONFIRMED",
    subject: "Confirmamos tu inscripción a El País que Miramos",
    bodyOutline: "Confirmación de pago aprobado y habilitación de la carga de fotografías.",
    scheduledLocal: null,
    category: "OPERATIONAL",
    audience: "REGISTERED_PARTICIPANTS",
    blockedReason: "Depende de DNX Payments (integración diferida).",
  },
  {
    code: "photo-upload-confirmed",
    eventType: "PHOTO_UPLOAD_CONFIRMED",
    subject: "Recibimos tu fotografía",
    bodyOutline: "Confirmación de carga de cada obra.",
    scheduledLocal: null,
    category: "OPERATIONAL",
    audience: "REGISTERED_PARTICIPANTS",
    blockedReason: "Depende de DNX Payments (integración diferida).",
  },
];

// ---------------------------------------------------------------------------
// Bases
// ---------------------------------------------------------------------------

export const RULES = {
  title: EL_PAIS_QUE_MIRAMOS_RULES_TITLE,
  content: EL_PAIS_QUE_MIRAMOS_RULES_DRAFT,
  /** Estado administrativo mientras no haya revisión legal. */
  legalReviewStatus: "PENDING" as const,
  legalReviewNote: "PENDIENTE DE REVISIÓN LEGAL",
};

// ---------------------------------------------------------------------------
// Requisitos técnicos (configurables, pendientes de validación)
// ---------------------------------------------------------------------------

export const TECHNICAL_REQUIREMENTS = {
  acceptedFormats: ["JPEG", "JPG"],
  recommendedColorProfile: "sRGB",
  /** null = pendiente de definir según la infraestructura vigente. */
  maxFileSizeBytes: null,
  minFileSizeBytes: null,
  minLongEdgePx: null,
  watermarkAllowed: false,
  authorMustKeepOriginal: true,
  pendingTechnicalValidation: true,
} as const;
