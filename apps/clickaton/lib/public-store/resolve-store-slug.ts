/**
 * Resolución determinista de storeSlug duplicado (unique por edición).
 *
 * Criterio (mayor prioridad primero):
 * 1. Candidatos ya filtrados como públicos (ACTIVE/OUT_OF_STOCK + flags).
 * 2. Edición vigente: isPublished > registrationEnabled > status score.
 * 3. updatedAt más reciente.
 * 4. id lexicográfico ascendente (estable).
 */

export type StoreSlugCandidate = {
  id: string;
  storeSlug: string;
  updatedAt: Date;
  edition: {
    isPublished: boolean;
    registrationEnabled: boolean;
    status: string;
  };
};

const EDITION_STATUS_SCORE: Record<string, number> = {
  REGISTRATION_OPEN: 50,
  IN_PROGRESS: 40,
  REGISTRATION_CLOSED: 30,
  COMPLETED: 20,
  REPROGRAMMED: 10,
  DRAFT: 0,
  CANCELLED: -100,
};

export function editionVigencyScore(edition: StoreSlugCandidate["edition"]): number {
  let score = 0;
  if (edition.isPublished) score += 1000;
  if (edition.registrationEnabled) score += 100;
  score += EDITION_STATUS_SCORE[edition.status] ?? 0;
  return score;
}

/** Comparator: negativo si `a` gana sobre `b`. */
export function compareStoreSlugCandidates(
  a: StoreSlugCandidate,
  b: StoreSlugCandidate,
): number {
  const vigency = editionVigencyScore(b.edition) - editionVigencyScore(a.edition);
  if (vigency !== 0) return vigency;

  const aTime = a.updatedAt.getTime();
  const bTime = b.updatedAt.getTime();
  if (bTime !== aTime) return bTime - aTime;

  return a.id.localeCompare(b.id);
}

/** Elige un único ganador; undefined si la lista está vacía. */
export function pickStoreSlugWinner<T extends StoreSlugCandidate>(
  candidates: readonly T[],
): T | undefined {
  if (candidates.length === 0) return undefined;
  return [...candidates].sort(compareStoreSlugCandidates)[0];
}
