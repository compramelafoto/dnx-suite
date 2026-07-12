/**
 * Preparación IA (Etapa futura) — contrato sin ejecución.
 */

export type AiPrepContract = {
  status: "NOT_READY" | "READY" | "QUEUED" | "COMPLETED";
  canEnqueue: boolean;
  reasons: string[];
  suggestedActions: string[];
};

export function buildAiPrepContract(input: {
  photoCount: number;
  photographerCount: number;
  commercialStatus: string;
  syncStatus: string;
  currentStatus?: string;
}): AiPrepContract {
  const reasons: string[] = [];
  if (input.syncStatus === "STALE" || input.syncStatus === "DISABLED") {
    reasons.push("Cobertura STALE o deshabilitada.");
  }
  if (input.photoCount <= 0) reasons.push("Sin fotos utilizables.");
  if (input.photographerCount <= 0) reasons.push("Sin fotógrafos identificados.");
  if (input.commercialStatus === "UNAVAILABLE") {
    reasons.push("Álbum comercialmente no disponible (IA puede esperar).");
  }

  const canEnqueue = reasons.length === 0;
  const status =
    input.currentStatus === "QUEUED" || input.currentStatus === "COMPLETED"
      ? (input.currentStatus as AiPrepContract["status"])
      : canEnqueue
        ? "READY"
        : "NOT_READY";

  return {
    status,
    canEnqueue,
    reasons,
    suggestedActions: canEnqueue
      ? [
          "Generar resumen stub",
          "Sugerir titulares",
          "Priorizar fotos candidatas (Etapa 9)",
        ]
      : ["Completar sync y fotógrafos antes de encolar IA"],
  };
}

/** Resumen editorial stub (sin LLM). */
export function buildCoverageSummaryStub(input: {
  title: string;
  city: string | null;
  eventTitle: string | null;
  photoCount: number;
  photographerNames: string[];
}): string {
  const where = input.city?.trim() || "ubicación por confirmar";
  const event = input.eventTitle?.trim() || input.title;
  const names =
    input.photographerNames.length > 0
      ? input.photographerNames.slice(0, 4).join(", ")
      : "fotógrafos por acreditar";
  return `Cobertura fotográfica de «${event}» en ${where}. ${input.photoCount} fotos disponibles. Créditos: ${names}.`;
}
