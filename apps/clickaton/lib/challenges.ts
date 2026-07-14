import type { PublicChallenge, PublicMarathon } from "@/types/marathon";

/**
 * Reglas de seguridad para consignas (contrato Clickaton ↔ FotoRank).
 *
 * - Nunca exponer title/description si no están liberadas.
 * - `revealed === true` y `status === "released"` son condiciones necesarias.
 * - Tras el evento, solo si `publicAfterEvent` y el contenido sigue marcado revealed.
 * - Clickaton no inventa consignas; solo presenta las que FotoRank autorice.
 */

export function isChallengePubliclyVisible(challenge: PublicChallenge): boolean {
  if (!challenge.revealed) return false;
  if (challenge.status === "hidden") return false;
  if (challenge.status !== "released" && challenge.status !== "closed") return false;
  if (!challenge.title?.trim()) return false;
  return true;
}

/** Consignas seguras para UI pública. Nunca devolver payloads ocultos. */
export function getPublicVisibleChallenges(
  marathon: Pick<PublicMarathon, "challenges">,
): PublicChallenge[] {
  return (marathon.challenges ?? [])
    .filter(isChallengePubliclyVisible)
    .map((challenge) => ({
      id: challenge.id,
      order: challenge.order,
      title: challenge.title,
      description: challenge.description,
      status: challenge.status,
      releaseAt: challenge.releaseAt,
      submissionCloseAt: challenge.submissionCloseAt,
      revealed: true,
      publicAfterEvent: challenge.publicAfterEvent,
      educationalGoal: challenge.educationalGoal,
    }))
    .sort((a, b) => a.order - b.order);
}

export function countHiddenChallenges(
  marathon: Pick<PublicMarathon, "challenges">,
): number {
  const total = marathon.challenges?.length ?? 0;
  const visible = getPublicVisibleChallenges(marathon).length;
  return Math.max(0, total - visible);
}
