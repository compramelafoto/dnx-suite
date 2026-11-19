/**
 * Presentation helpers for the public contest landing.
 * Pure logic — no Prisma, no peer-product UI imports.
 */

export type LandingPhase =
  | "coming-soon"
  | "open"
  | "last-days"
  | "closed"
  | "uploads-only"
  | "in-evaluation"
  | "finalized";

export type LandingPhaseInput = {
  status: string;
  startAt: Date | null;
  submissionDeadline: Date | null;
  /** Cierre de inscripción, si difiere de la entrega. */
  registrationClosesAt?: Date | null;
  judgingStartAt: Date | null;
  resultsAt: Date | null;
  now?: number;
};

export const PHASE_LABEL: Record<LandingPhase, string> = {
  "coming-soon": "Próximamente",
  open: "Inscripciones abiertas",
  "last-days": "Últimos días",
  closed: "Inscripciones cerradas",
  "uploads-only": "Carga de fotos abierta",
  "in-evaluation": "En evaluación",
  finalized: "Finalizado",
};

export function getLandingPhase(data: LandingPhaseInput): LandingPhase {
  const now = data.now ?? Date.now();
  const start = data.startAt?.getTime() ?? null;
  const deadline = data.submissionDeadline?.getTime() ?? null;
  const judgingStart = data.judgingStartAt?.getTime() ?? null;
  const results = data.resultsAt?.getTime() ?? null;
  const registrationClose = data.registrationClosesAt?.getTime() ?? null;

  if (data.status === "ARCHIVED") return "finalized";
  if (data.status === "CLOSED") return "closed";
  if (results && now >= results) return "finalized";
  // La organización puede reabrir sólo la carga para quienes ya están inscriptos
  // (Santa Fe en Foco, 14/11 y 19/11): la inscripción sigue cerrada pero la
  // entrega no. Mientras se reciben fotos no se está evaluando, aunque la fecha
  // de inicio de evaluación guardada haya quedado atrás.
  if (registrationClose && deadline && now >= registrationClose && now < deadline) {
    return "uploads-only";
  }
  if (judgingStart && now >= judgingStart && (!results || now < results)) return "in-evaluation";
  if (deadline && now > deadline) return "closed";
  if (start && now < start) return "coming-soon";
  if (deadline) {
    const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) return "last-days";
  }
  return "open";
}

export type PhaseCta = {
  primary: string;
  enabled: boolean;
  tone: "primary" | "neutral" | "closed";
};

/** CTA never offers a functionally closed action. */
export function phaseCta(phase: LandingPhase): PhaseCta {
  if (phase === "uploads-only") {
    return { primary: "Cargar mi foto", enabled: true, tone: "primary" };
  }
  if (phase === "closed" || phase === "in-evaluation" || phase === "finalized") {
    return { primary: "Inscripciones cerradas", enabled: false, tone: "closed" };
  }
  if (phase === "coming-soon") {
    return { primary: "Inscripción próximamente", enabled: false, tone: "neutral" };
  }
  if (phase === "last-days") {
    return { primary: "Inscribirme", enabled: true, tone: "primary" };
  }
  return { primary: "Inscribirme", enabled: true, tone: "primary" };
}

export function finalCtaCopy(
  phase: LandingPhase,
  uploadDeadlineLabel?: string | null,
): { title: string; body: string; action: string } {
  switch (phase) {
    case "uploads-only":
      return {
        title: "Carga de fotos abierta para inscriptos",
        body: `La inscripción ya cerró. Si ya estás inscripto, podés cargar tu fotografía${
          uploadDeadlineLabel ? ` hasta el ${uploadDeadlineLabel}` : ""
        }.`,
        action: "Cargar mi foto",
      };
    case "coming-soon":
      return {
        title: "Inscripciones próximamente",
        body: "Todavía no podés inscribirte. Revisá el cronograma y volvé cuando abra la convocatoria.",
        action: "Inscripción próximamente",
      };
    case "last-days":
      return {
        title: "Últimos días para inscribirte",
        body: "Las inscripciones cierran pronto. Completá tus datos y asegurá tu lugar.",
        action: "Inscribirme",
      };
    case "closed":
      return {
        title: "Inscripciones cerradas",
        body: "Ya no se reciben nuevas inscripciones para este concurso.",
        action: "Inscripciones cerradas",
      };
    case "in-evaluation":
      return {
        title: "En evaluación",
        body: "El jurado está evaluando las obras. Los resultados se publicarán según el cronograma.",
        action: "En evaluación",
      };
    case "finalized":
      return {
        title: "Concurso finalizado",
        body: "Esta edición ya cerró. Podés consultar resultados si están disponibles.",
        action: "Concurso finalizado",
      };
    default:
      return {
        title: "Inscripciones abiertas",
        body: "Completá tu inscripción y seguí los pasos para presentar tu obra.",
        action: "Inscribirme",
      };
  }
}
