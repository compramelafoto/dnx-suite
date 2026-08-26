/**
 * Ciclo de vida de un concurso FotoRank — fuente de verdad de fases y capacidades.
 *
 * Contexto: el enum `FotorankContestStatus` nació como ciclo de *setup y publicación*
 * (DRAFT → READY_TO_PUBLISH → PUBLISHED → CLOSED → ARCHIVED) para Clickatón y
 * Santa Fe en Foco. Se amplió de forma aditiva con las fases operativas
 * (UPCOMING, REGISTRATION_OPEN, …) sin tocar la semántica de los valores previos.
 *
 * Invariante de compatibilidad: los estados legacy conservan EXACTAMENTE su
 * comportamiento anterior. Las capacidades nuevas (registro de interés, gates de
 * publicación por fase) sólo se activan en los estados del ciclo extendido.
 */

/** Valores persistidos en `FotorankContest.status`. */
export const CONTEST_LIFECYCLE_PHASES = [
  "DRAFT",
  "UPCOMING",
  "REGISTRATION_OPEN",
  "SUBMISSIONS_CLOSED",
  "ADMISSION",
  "JUDGING",
  "FINALISTS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ContestLifecyclePhase = (typeof CONTEST_LIFECYCLE_PHASES)[number];

/** Estados históricos que NO forman parte del ciclo extendido. */
export const LEGACY_CONTEST_STATUSES = [
  "SETUP_IN_PROGRESS",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "ACTIVE",
  "CLOSED",
  "ARCHIVED",
] as const;

export type LegacyContestStatus = (typeof LEGACY_CONTEST_STATUSES)[number];

export type AnyContestStatus = ContestLifecyclePhase | LegacyContestStatus;

const LIFECYCLE_SET = new Set<string>(CONTEST_LIFECYCLE_PHASES);
const LEGACY_SET = new Set<string>(LEGACY_CONTEST_STATUSES);

export function isLifecyclePhase(status: string): status is ContestLifecyclePhase {
  return LIFECYCLE_SET.has(status);
}

export function isLegacyContestStatus(status: string): status is LegacyContestStatus {
  return LEGACY_SET.has(status);
}

export const CONTEST_LIFECYCLE_LABELS: Record<ContestLifecyclePhase, string> = {
  DRAFT: "Borrador",
  UPCOMING: "Próximamente",
  REGISTRATION_OPEN: "Inscripciones abiertas",
  SUBMISSIONS_CLOSED: "Inscripción cerrada",
  ADMISSION: "En admisión",
  JUDGING: "En evaluación",
  FINALISTS: "Finalistas",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
};

/**
 * Capacidades derivadas de la fase. Ninguna depende del cliente.
 *
 * `allowsPayments` responde sólo por la fase: el cobro real exige ADEMÁS que
 * DNX Payments esté implementado y habilitado (ver `canAcceptPayments`).
 */
export type LifecycleCapabilities = {
  /** Puede aparecer en listados y landings públicas. */
  publiclyVisible: boolean;
  /** Muestra el badge "PRÓXIMAMENTE" y el botón "Notificarme". */
  acceptsInterestRegistration: boolean;
  /** La fase, por sí sola, no impide cobrar. */
  allowsPayments: boolean;
  /** Permite carga de fotografías. */
  allowsSubmissions: boolean;
  /** Permite despachar emails reales (además de la política de entorno). */
  allowsRealEmails: boolean;
};

const CAPABILITIES: Record<ContestLifecyclePhase, LifecycleCapabilities> = {
  DRAFT: {
    publiclyVisible: false,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: false,
  },
  UPCOMING: {
    publiclyVisible: true,
    acceptsInterestRegistration: true,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: true,
  },
  REGISTRATION_OPEN: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: true,
    allowsSubmissions: true,
    allowsRealEmails: true,
  },
  SUBMISSIONS_CLOSED: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: true,
  },
  ADMISSION: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: true,
  },
  JUDGING: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: true,
  },
  FINALISTS: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: true,
  },
  COMPLETED: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: true,
  },
  CANCELLED: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: true,
  },
};

/**
 * Capacidades de un estado legacy. Preserva el comportamiento histórico:
 * PUBLISHED/ACTIVE son públicos y su cobro/carga siguen gobernados por
 * `registrationEnabled` y las ventanas de fecha, exactamente como antes.
 */
const LEGACY_CAPABILITIES: Record<LegacyContestStatus, LifecycleCapabilities> = {
  SETUP_IN_PROGRESS: {
    publiclyVisible: false,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: false,
  },
  READY_TO_PUBLISH: {
    publiclyVisible: false,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: false,
  },
  PUBLISHED: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: true,
    allowsSubmissions: true,
    allowsRealEmails: true,
  },
  ACTIVE: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: true,
    allowsSubmissions: true,
    allowsRealEmails: true,
  },
  CLOSED: {
    publiclyVisible: true,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: true,
  },
  ARCHIVED: {
    publiclyVisible: false,
    acceptsInterestRegistration: false,
    allowsPayments: false,
    allowsSubmissions: false,
    allowsRealEmails: false,
  },
};

/** Capacidades de cualquier estado. Un valor desconocido se trata como borrador. */
export function getLifecycleCapabilities(status: string): LifecycleCapabilities {
  if (isLifecyclePhase(status)) return CAPABILITIES[status];
  if (isLegacyContestStatus(status)) return LEGACY_CAPABILITIES[status];
  return CAPABILITIES.DRAFT;
}

/** Un concurso en borrador nunca puede aparecer públicamente. */
export function isPubliclyVisibleStatus(status: string): boolean {
  return getLifecycleCapabilities(status).publiclyVisible;
}

/** Estados que un listado público puede consultar. Deriva de las capacidades. */
export const PUBLICLY_VISIBLE_STATUSES: AnyContestStatus[] = [
  ...CONTEST_LIFECYCLE_PHASES,
  ...LEGACY_CONTEST_STATUSES,
].filter((s) => getLifecycleCapabilities(s).publiclyVisible) as AnyContestStatus[];

/** Estados que muestran el botón "Notificarme". */
export function acceptsInterestRegistration(status: string): boolean {
  return getLifecycleCapabilities(status).acceptsInterestRegistration;
}

/**
 * Cobro efectivo. Además de la fase, exige que DNX Payments esté habilitado.
 * Mientras la integración esté diferida esto devuelve false siempre.
 */
export function canAcceptPayments(input: {
  status: string;
  dnxPaymentsEnabled: boolean;
}): boolean {
  return getLifecycleCapabilities(input.status).allowsPayments && input.dnxPaymentsEnabled;
}

export function canAcceptSubmissions(status: string): boolean {
  return getLifecycleCapabilities(status).allowsSubmissions;
}

// ---------------------------------------------------------------------------
// Transiciones
// ---------------------------------------------------------------------------

/**
 * Transiciones permitidas del ciclo extendido.
 * DRAFT → UPCOMING y UPCOMING → REGISTRATION_OPEN son acciones administrativas
 * explícitas y sujetas a gates (ver publication-gates.ts).
 */
const ALLOWED_TRANSITIONS: Record<ContestLifecyclePhase, ContestLifecyclePhase[]> = {
  DRAFT: ["UPCOMING", "CANCELLED"],
  UPCOMING: ["REGISTRATION_OPEN", "DRAFT", "CANCELLED"],
  REGISTRATION_OPEN: ["SUBMISSIONS_CLOSED", "CANCELLED"],
  SUBMISSIONS_CLOSED: ["ADMISSION", "CANCELLED"],
  ADMISSION: ["JUDGING", "CANCELLED"],
  JUDGING: ["FINALISTS", "CANCELLED"],
  FINALISTS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export type TransitionCheck =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Valida una transición de fase. No evalúa los gates de contenido: eso es
 * responsabilidad de `evaluatePublicationGate`, que se consulta antes.
 */
export function canTransition(from: string, to: string): TransitionCheck {
  if (!isLifecyclePhase(to)) {
    return { allowed: false, reason: `"${to}" no es una fase del ciclo extendido.` };
  }
  if (!isLifecyclePhase(from)) {
    // Un concurso legacy no se migra automáticamente al ciclo extendido.
    return {
      allowed: false,
      reason:
        `El concurso está en el estado histórico "${from}". ` +
        "Migrarlo al ciclo extendido requiere una decisión administrativa explícita.",
    };
  }
  if (from === to) return { allowed: false, reason: "El concurso ya está en esa fase." };
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return {
      allowed: false,
      reason: `Transición no permitida: ${CONTEST_LIFECYCLE_LABELS[from]} → ${CONTEST_LIFECYCLE_LABELS[to]}.`,
    };
  }
  return { allowed: true };
}

/** Transiciones que exigen autorización administrativa explícita (nunca automáticas). */
export const EXPLICIT_ADMIN_TRANSITIONS: Array<[ContestLifecyclePhase, ContestLifecyclePhase]> = [
  ["DRAFT", "UPCOMING"],
  ["UPCOMING", "REGISTRATION_OPEN"],
];

export function requiresExplicitAdminAction(from: string, to: string): boolean {
  return EXPLICIT_ADMIN_TRANSITIONS.some(([f, t]) => f === from && t === to);
}
