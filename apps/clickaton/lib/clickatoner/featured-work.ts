/**
 * La obra que se muestra de un clickatoner. Módulo puro.
 *
 * La premiada primero (el premio más alto), después la mejor ubicada, y si ninguna tiene puesto,
 * la primera que haya. Entre ediciones gana la más reciente ante un empate: es la que mejor
 * cuenta cómo fotografía hoy.
 */

export type WorkCandidate = {
  submissionId: string;
  editionEndAt: Date | null;
  premio: string | null;
  puesto: number | null;
};

const ORDEN_DEL_PREMIO: Record<string, number> = {
  FIRST_PLACE: 1,
  SECOND_PLACE: 2,
  THIRD_PLACE: 3,
  SPECIAL: 4,
  SPECIAL_MENTION: 4,
  SPONSOR_AWARD: 4,
  PEOPLE_CHOICE: 4,
  CUSTOM: 4,
  FINALIST: 5,
  HONORABLE_MENTION: 6,
};

function rangoDelPremio(premio: string | null): number {
  if (!premio) return 99;
  return ORDEN_DEL_PREMIO[premio] ?? 7;
}

export function pickFeaturedWork(works: readonly WorkCandidate[]): WorkCandidate | null {
  if (works.length === 0) return null;
  return [...works].sort((a, b) => {
    const premio = rangoDelPremio(a.premio) - rangoDelPremio(b.premio);
    if (premio !== 0) return premio;
    const pa = a.puesto ?? Number.POSITIVE_INFINITY;
    const pb = b.puesto ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    const fa = a.editionEndAt?.getTime() ?? 0;
    const fb = b.editionEndAt?.getTime() ?? 0;
    if (fa !== fb) return fb - fa;
    return a.submissionId.localeCompare(b.submissionId);
  })[0] ?? null;
}
