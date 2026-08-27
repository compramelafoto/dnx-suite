/**
 * Comunicaciones de concurso — catálogo de eventos y política de despacho.
 *
 * Este módulo NO envía. Decide si un envío está permitido y con qué clave de
 * idempotencia. El envío efectivo pasa por `FotorankTransactionalEmailOutbox`.
 *
 * Bloqueos absolutos, en este orden:
 *   1. Concurso en DRAFT → nunca se envía nada real.
 *   2. Entorno no productivo → nunca se envía real salvo modo test explícito.
 *   3. Consentimiento ausente o revocado → no se envía promocional.
 *   4. Clave de idempotencia ya usada → no se reenvía.
 */

import { getLifecycleCapabilities } from "./lifecycle";

/** Comunicaciones imprescindibles de una participación ya confirmada. */
export type CommunicationCategory = "OPERATIONAL" | "PROMOTIONAL";

export type CommunicationAudience =
  /** Interesados con consentimiento específico vigente para este concurso. */
  | "INTEREST_SPECIFIC"
  /** Usuarios con consentimiento general de FotoRank vigente. */
  | "GENERAL_OPT_IN"
  /** Participantes con inscripción confirmada. */
  | "REGISTERED_PARTICIPANTS";

export type CommunicationEventType =
  | "INTEREST_CONFIRMED"
  | "PRELAUNCH_REMINDER"
  | "REGISTRATION_OPENED"
  | "PROMO_PRICE_REMINDER"
  | "PROMO_PRICE_EXPIRING"
  | "PROMO_PRICE_LAST_DAY"
  | "PRICE_PHASE_STARTED"
  | "PAYMENT_CONFIRMED"
  | "PHOTO_UPLOAD_CONFIRMED"
  | "ENTRY_OBSERVATION"
  | "ADMISSION_CONFIRMED"
  | "JUDGING_STARTED"
  | "FINALIST_NOTIFICATION"
  | "RESULTS_ANNOUNCED"
  | "PARTICIPATION_CERTIFICATE";

export type CommunicationEventDefinition = {
  type: CommunicationEventType;
  label: string;
  category: CommunicationCategory;
  defaultAudience: CommunicationAudience;
  /** Bloqueado hasta que DNX Payments esté implementado y habilitado. */
  requiresPayments: boolean;
  description: string;
};

/** Catálogo completo. Los eventos de pago quedan definidos pero inoperantes. */
export const COMMUNICATION_EVENTS: Record<CommunicationEventType, CommunicationEventDefinition> = {
  INTEREST_CONFIRMED: {
    type: "INTEREST_CONFIRMED",
    label: "Confirmación de “Notificarme”",
    category: "PROMOTIONAL",
    defaultAudience: "INTEREST_SPECIFIC",
    requiresPayments: false,
    description: "Se envía al registrar el interés. Confirma el beneficio y la fecha de apertura.",
  },
  PRELAUNCH_REMINDER: {
    type: "PRELAUNCH_REMINDER",
    label: "Recordatorio previo al lanzamiento",
    category: "PROMOTIONAL",
    defaultAudience: "INTEREST_SPECIFIC",
    requiresPayments: false,
    description: "Recuerda la apertura y adelanta la consigna.",
  },
  REGISTRATION_OPENED: {
    type: "REGISTRATION_OPENED",
    label: "Apertura de inscripciones",
    category: "PROMOTIONAL",
    defaultAudience: "INTEREST_SPECIFIC",
    requiresPayments: false,
    description: "Anuncia la apertura, la consigna, el premio, el jurado y los precios.",
  },
  PROMO_PRICE_REMINDER: {
    type: "PROMO_PRICE_REMINDER",
    label: "Recordatorio del precio promocional",
    category: "PROMOTIONAL",
    defaultAudience: "INTEREST_SPECIFIC",
    requiresPayments: false,
    description: "Recuerda el beneficio exclusivo y su fecha límite.",
  },
  PROMO_PRICE_EXPIRING: {
    type: "PROMO_PRICE_EXPIRING",
    label: "Aviso de vencimiento cercano",
    category: "PROMOTIONAL",
    defaultAudience: "INTEREST_SPECIFIC",
    requiresPayments: false,
    description: "Aviso previo al vencimiento del precio promocional.",
  },
  PROMO_PRICE_LAST_DAY: {
    type: "PROMO_PRICE_LAST_DAY",
    label: "Último día del precio promocional",
    category: "PROMOTIONAL",
    defaultAudience: "INTEREST_SPECIFIC",
    requiresPayments: false,
    description: "Último día de vigencia del beneficio.",
  },
  PRICE_PHASE_STARTED: {
    type: "PRICE_PHASE_STARTED",
    label: "Apertura de una nueva etapa de precios",
    category: "PROMOTIONAL",
    defaultAudience: "GENERAL_OPT_IN",
    requiresPayments: false,
    description: "Comunica el cambio de etapa de precios.",
  },
  PAYMENT_CONFIRMED: {
    type: "PAYMENT_CONFIRMED",
    label: "Confirmación de pago",
    category: "OPERATIONAL",
    defaultAudience: "REGISTERED_PARTICIPANTS",
    requiresPayments: true,
    description: "Preparado. Inoperante hasta integrar DNX Payments.",
  },
  PHOTO_UPLOAD_CONFIRMED: {
    type: "PHOTO_UPLOAD_CONFIRMED",
    label: "Confirmación de carga de fotografías",
    category: "OPERATIONAL",
    defaultAudience: "REGISTERED_PARTICIPANTS",
    requiresPayments: true,
    description: "Depende de la habilitación de carga por pago aprobado.",
  },
  ENTRY_OBSERVATION: {
    type: "ENTRY_OBSERVATION",
    label: "Observación o corrección de una obra",
    category: "OPERATIONAL",
    defaultAudience: "REGISTERED_PARTICIPANTS",
    requiresPayments: false,
    description: "Solicita corregir una obra observada en admisión.",
  },
  ADMISSION_CONFIRMED: {
    type: "ADMISSION_CONFIRMED",
    label: "Confirmación de admisión",
    category: "OPERATIONAL",
    defaultAudience: "REGISTERED_PARTICIPANTS",
    requiresPayments: false,
    description: "Confirma que la obra pasó el control de admisión.",
  },
  JUDGING_STARTED: {
    type: "JUDGING_STARTED",
    label: "Inicio de evaluación",
    category: "OPERATIONAL",
    defaultAudience: "REGISTERED_PARTICIPANTS",
    requiresPayments: false,
    description: "Informa el inicio de la evaluación del jurado.",
  },
  FINALIST_NOTIFICATION: {
    type: "FINALIST_NOTIFICATION",
    label: "Notificación de finalista",
    category: "OPERATIONAL",
    defaultAudience: "REGISTERED_PARTICIPANTS",
    requiresPayments: false,
    description: "Notificación privada a finalistas.",
  },
  RESULTS_ANNOUNCED: {
    type: "RESULTS_ANNOUNCED",
    label: "Anuncio de resultados",
    category: "OPERATIONAL",
    defaultAudience: "REGISTERED_PARTICIPANTS",
    requiresPayments: false,
    description: "Anuncio público de resultados.",
  },
  PARTICIPATION_CERTIFICATE: {
    type: "PARTICIPATION_CERTIFICATE",
    label: "Certificado de participación",
    category: "OPERATIONAL",
    defaultAudience: "REGISTERED_PARTICIPANTS",
    requiresPayments: false,
    description: "Entrega del certificado de participación.",
  },
};

// ---------------------------------------------------------------------------
// Política de envío
// ---------------------------------------------------------------------------

export type SendMode = "LIVE" | "PREVIEW" | "TEST";

export type RecipientConsentState = {
  /** Consentimiento específico vigente para ESTE concurso. */
  contestSpecificOptIn: boolean;
  /** Consentimiento general de FotoRank vigente. */
  generalOptIn: boolean;
  /** Baja global de comunicaciones promocionales. */
  unsubscribedFromPromotional: boolean;
  /** Inscripción confirmada en este concurso. */
  isRegisteredParticipant: boolean;
};

export type DispatchEnvironment = {
  /** Entorno resuelto del proceso. */
  environment: "production" | "preview" | "development" | "test";
  /** DNX Payments implementado y habilitado. Hoy: false. */
  dnxPaymentsEnabled: boolean;
};

export type DispatchDecisionInput = {
  eventType: CommunicationEventType;
  contestStatus: string;
  audience: CommunicationAudience;
  recipient: RecipientConsentState;
  env: DispatchEnvironment;
  mode: SendMode;
  /** Claves ya despachadas (idempotencia). */
  alreadyDispatched?: (key: string) => boolean;
  idempotencyKey: string;
};

export type DispatchBlockReason =
  | "CONTEST_IN_DRAFT"
  | "NON_PRODUCTION_ENVIRONMENT"
  | "PAYMENTS_NOT_ENABLED"
  | "NO_VALID_CONSENT"
  | "UNSUBSCRIBED"
  | "NOT_A_PARTICIPANT"
  | "ALREADY_DISPATCHED";

export type DispatchDecision =
  | { allowed: true; mode: SendMode; idempotencyKey: string }
  | { allowed: false; reason: DispatchBlockReason; message: string };

/**
 * ¿Este destinatario tiene base válida para recibir esta comunicación?
 *
 * Importante: participar en otro concurso NO otorga consentimiento acá, y el
 * consentimiento específico de un concurso no habilita comunicaciones generales.
 */
export function hasValidConsent(
  audience: CommunicationAudience,
  category: CommunicationCategory,
  recipient: RecipientConsentState,
): boolean {
  // Las comunicaciones operativas de una participación confirmada no dependen
  // del opt-in promocional, pero sí exigen ser participante.
  if (category === "OPERATIONAL") {
    return recipient.isRegisteredParticipant;
  }
  if (recipient.unsubscribedFromPromotional) return false;
  switch (audience) {
    case "INTEREST_SPECIFIC":
      return recipient.contestSpecificOptIn;
    case "GENERAL_OPT_IN":
      return recipient.generalOptIn;
    case "REGISTERED_PARTICIPANTS":
      return recipient.isRegisteredParticipant;
    default:
      return false;
  }
}

export function decideDispatch(input: DispatchDecisionInput): DispatchDecision {
  const def = COMMUNICATION_EVENTS[input.eventType];

  // 1. Borrador: bloqueo absoluto de envíos reales.
  if (input.mode === "LIVE" && !getLifecycleCapabilities(input.contestStatus).allowsRealEmails) {
    return {
      allowed: false,
      reason: "CONTEST_IN_DRAFT",
      message:
        "El concurso está en borrador: no se despachan comunicaciones reales hasta su activación.",
    };
  }

  // 2. Entorno: sólo producción envía en vivo.
  if (input.mode === "LIVE" && input.env.environment !== "production") {
    return {
      allowed: false,
      reason: "NON_PRODUCTION_ENVIRONMENT",
      message: `Envío real bloqueado en entorno "${input.env.environment}". Usá modo PREVIEW o TEST.`,
    };
  }

  // 3. Eventos que dependen de DNX Payments.
  if (def.requiresPayments && !input.env.dnxPaymentsEnabled) {
    return {
      allowed: false,
      reason: "PAYMENTS_NOT_ENABLED",
      message: "Esta comunicación depende de DNX Payments, que todavía no está habilitado.",
    };
  }

  // 4. Consentimiento.
  if (!hasValidConsent(input.audience, def.category, input.recipient)) {
    if (def.category === "PROMOTIONAL" && input.recipient.unsubscribedFromPromotional) {
      return {
        allowed: false,
        reason: "UNSUBSCRIBED",
        message: "El destinatario canceló las comunicaciones promocionales.",
      };
    }
    if (input.audience === "REGISTERED_PARTICIPANTS" && !input.recipient.isRegisteredParticipant) {
      return {
        allowed: false,
        reason: "NOT_A_PARTICIPANT",
        message: "El destinatario no tiene una inscripción confirmada.",
      };
    }
    return {
      allowed: false,
      reason: "NO_VALID_CONSENT",
      message: "El destinatario no tiene consentimiento válido para esta comunicación.",
    };
  }

  // 5. Idempotencia.
  if (input.alreadyDispatched?.(input.idempotencyKey)) {
    return {
      allowed: false,
      reason: "ALREADY_DISPATCHED",
      message: "Esta comunicación ya fue despachada para este destinatario.",
    };
  }

  return { allowed: true, mode: input.mode, idempotencyKey: input.idempotencyKey };
}

/**
 * Clave de idempotencia estable. El mismo evento, para el mismo destinatario y
 * la misma ocurrencia, produce siempre la misma clave.
 */
export function buildIdempotencyKey(input: {
  contestId: string;
  eventType: CommunicationEventType;
  userId: number;
  /** Discriminante de ocurrencia (p. ej. el código de la comunicación programada). */
  occurrence?: string;
}): string {
  const parts = [
    "fr-upcoming",
    input.contestId,
    input.eventType,
    String(input.userId),
    input.occurrence ?? "default",
  ];
  return parts.join(":");
}

/** Entorno de despacho resuelto desde variables de entorno. */
export function resolveDispatchEnvironment(
  env: Record<string, string | undefined> = process.env,
): DispatchEnvironment {
  const vercelEnv = (env.VERCEL_ENV ?? "").toLowerCase();
  const nodeEnv = (env.NODE_ENV ?? "").toLowerCase();
  let environment: DispatchEnvironment["environment"] = "development";
  if (vercelEnv === "production") environment = "production";
  else if (vercelEnv === "preview") environment = "preview";
  else if (nodeEnv === "test") environment = "test";
  else if (nodeEnv === "production" && !vercelEnv) environment = "production";

  return {
    environment,
    // DNX Payments está diferido: la bandera existe pero por defecto es false.
    dnxPaymentsEnabled: env.DNX_PAYMENTS_ENABLED === "1",
  };
}
