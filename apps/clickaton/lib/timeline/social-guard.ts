/**
 * Social Publisher no debe publicar texto secreto de consignas.
 * Por defecto solo hitos públicos (sin title/instructions de prompt).
 */

const FORBIDDEN_ENTITY = new Set(["PROMPT", "CLICKATON_PROMPT", "CONSIGNA"]);

export function assertSocialCaptionSafeForTimeline(input: {
  entityType: string;
  caption: string;
  promptTitle?: string | null;
  promptInstructions?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  if (FORBIDDEN_ENTITY.has(input.entityType.toUpperCase())) {
    return { ok: false, reason: "ENTITY_PROMPT_FORBIDDEN_BY_DEFAULT" };
  }
  const caption = input.caption.trim();
  if (input.promptTitle && caption.includes(input.promptTitle)) {
    return { ok: false, reason: "CAPTION_CONTAINS_PROMPT_TITLE" };
  }
  if (input.promptInstructions && caption.includes(input.promptInstructions)) {
    return { ok: false, reason: "CAPTION_CONTAINS_PROMPT_INSTRUCTIONS" };
  }
  return { ok: true };
}

export function buildSafeTimelineSocialCaption(kind: "MARATHON_START" | "PROMPT_RELEASED" | "MARATHON_END" | "RESULTS"): string {
  switch (kind) {
    case "MARATHON_START":
      return "Comenzó Clickatón. Seguinos para los hitos públicos de la jornada.";
    case "PROMPT_RELEASED":
      return "Nueva consigna liberada para participantes acreditados. El detalle está en el dashboard.";
    case "MARATHON_END":
      return "Finalizó la maratón fotográfica. Gracias por participar.";
    case "RESULTS":
      return "Resultados disponibles. Revisá la ficha de la edición.";
    default:
      return "Actualización Clickatón.";
  }
}
