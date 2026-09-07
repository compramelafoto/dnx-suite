/**
 * Reparto de menciones entre etiqueta de colaborador y texto del copy.
 *
 * Instagram no documenta un límite estable de colaboradores (3, 4 o 5 según la época y el
 * tipo de cuenta), así que el reparto es dinámico y degradable: si Meta rechaza la lista,
 * se baja una al copy y se reintenta. Nadie desaparece.
 */

export const DEFAULT_MAX_COLLABORATORS = 3;

export type MentionCandidate = {
  /** Usuario de Instagram ya normalizado, sin @. */
  handle: string;
  /** Menor es más importante. */
  priority: number;
  /** Para qué está: PHOTOGRAPHER, ORGANIZER, SPONSOR, PLATFORM… */
  role: string;
};

export type MentionPlan = {
  collaborators: string[];
  captionMentions: string[];
};

export function planMentions(
  candidates: MentionCandidate[],
  maxCollaborators: number = DEFAULT_MAX_COLLABORATORS,
): MentionPlan {
  const vistos = new Set<string>();
  const ordenados = [...candidates]
    .sort((a, b) => a.priority - b.priority)
    .map((c) => c.handle.trim())
    .filter((h) => {
      if (!h) return false;
      if (vistos.has(h)) return false;
      vistos.add(h);
      return true;
    });

  const tope = Math.max(0, maxCollaborators);
  return {
    collaborators: ordenados.slice(0, tope),
    captionMentions: ordenados.slice(tope),
  };
}

/**
 * Baja un colaborador al copy. Devuelve null cuando ya no queda ninguno para bajar,
 * que es la señal de que el error de Meta no era por exceso de colaboradores.
 */
export function degradeMentionPlan(plan: MentionPlan): MentionPlan | null {
  if (plan.collaborators.length === 0) return null;
  const ultimo = plan.collaborators[plan.collaborators.length - 1] as string;
  return {
    collaborators: plan.collaborators.slice(0, -1),
    captionMentions: [ultimo, ...plan.captionMentions],
  };
}
