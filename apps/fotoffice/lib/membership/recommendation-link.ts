/**
 * De un código de enlace al socio que recomienda.
 *
 * Módulo PURO: recibe el candidato ya buscado en la base. La regla —qué código vale y
 * cuál no— se puede verificar sin montar nada, que es donde estaría el error caro:
 * atribuirle un alta al socio equivocado.
 */

import { normalizeRecommendationCode } from "./recommendation-code";

export type RecommenderCandidate = {
  id: string;
  workspaceId: string;
  status: string;
  firstName: string;
  lastName: string;
};

/**
 * Devuelve el recomendante, o `null`.
 *
 * **Nunca falla ruidosamente.** Un enlace viejo, de otra institución o de alguien que ya no
 * es socio no puede impedirle a nadie asociarse: el formulario se muestra igual, sin
 * mensajes de error, y el alta sigue su curso sin recomendación.
 */
export function resolveRecommender(input: {
  rawCode: string | null | undefined;
  workspaceId: string;
  candidate: RecommenderCandidate | null;
}): { memberId: string; displayName: string } | null {
  const code = normalizeRecommendationCode(input.rawCode);
  if (!code) return null;

  const c = input.candidate;
  if (!c) return null;
  if (c.workspaceId !== input.workspaceId) return null;
  if (c.status !== "ACTIVE") return null;

  return { memberId: c.id, displayName: `${c.firstName} ${c.lastName}`.trim() };
}
