import type { AssistantIntent, AssistantStepId } from "./types";

export type TimelineItem = {
  id: AssistantStepId;
  label: string;
};

/** Timeline completo (intención → listo para escribir). */
export const ASSISTANT_TIMELINE: readonly TimelineItem[] = [
  { id: "intent", label: "Qué querés contar" },
  { id: "event", label: "Evento" },
  { id: "material", label: "Coberturas" },
  { id: "photos", label: "Fotografías" },
  { id: "draft", label: "Preparar borrador" },
  { id: "summary", label: "Listo para escribir" },
] as const;

/**
 * Pasos visibles según la intención.
 * Independiente / galería sin material omiten evento y material.
 */
export function timelineForIntent(intent: AssistantIntent | null): TimelineItem[] {
  if (intent === "independent") {
    return ASSISTANT_TIMELINE.filter((s) =>
      ["intent", "draft", "summary"].includes(s.id),
    );
  }
  if (intent === "gallery") {
    return ASSISTANT_TIMELINE.filter((s) =>
      ["intent", "material", "photos", "draft", "summary"].includes(s.id),
    );
  }
  if (intent === "coverage") {
    return ASSISTANT_TIMELINE.filter((s) =>
      ["intent", "material", "photos", "draft", "summary"].includes(s.id),
    );
  }
  // event | pending | null → flujo completo
  return [...ASSISTANT_TIMELINE];
}

export function stepIndex(steps: TimelineItem[], step: AssistantStepId): number {
  return steps.findIndex((s) => s.id === step);
}

export function nextStep(
  intent: AssistantIntent | null,
  current: AssistantStepId,
): AssistantStepId | null {
  const steps = timelineForIntent(intent);
  const i = stepIndex(steps, current);
  if (i < 0 || i >= steps.length - 1) return null;
  return steps[i + 1]!.id;
}

export function prevStep(
  intent: AssistantIntent | null,
  current: AssistantStepId,
): AssistantStepId | null {
  const steps = timelineForIntent(intent);
  const i = stepIndex(steps, current);
  if (i <= 0) return null;
  return steps[i - 1]!.id;
}

/** Primer paso tras elegir intención. */
export function entryStepForIntent(intent: AssistantIntent): AssistantStepId {
  switch (intent) {
    case "independent":
      return "draft";
    case "coverage":
    case "gallery":
      return "material";
    case "pending":
      return "intent";
    case "event":
    default:
      return "event";
  }
}
