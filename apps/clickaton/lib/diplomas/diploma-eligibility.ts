import type { DiplomaCandidate } from "./diploma-types";

export type DiplomaCandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  visibleCode: string | null;
  checkIns: Array<{ checkedInAt: Date; reversedAt: Date | null }>;
};

/** Acreditado = al menos un check-in que nadie revirtió. */
export function isAccredited(checkIns: Array<{ reversedAt: Date | null }>): boolean {
  return checkIns.some((c) => c.reversedAt === null);
}

/**
 * Candidatos a diploma de una edición. Un participante con varios check-ins
 * vigentes produce un solo candidato, fechado en el primero.
 */
export function selectDiplomaCandidates(rows: DiplomaCandidateRow[]): DiplomaCandidate[] {
  const candidates: DiplomaCandidate[] = [];
  for (const row of rows) {
    const vigentes = row.checkIns
      .filter((c) => c.reversedAt === null)
      .sort((a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime());
    const primero = vigentes[0];
    if (!primero) continue;
    candidates.push({
      registrationId: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      visibleCode: row.visibleCode,
      email: row.email,
      accreditedAt: primero.checkedInAt,
    });
  }
  return candidates;
}

/** Lectura de candidatos de una edición. La consulta vive acá y no en la pantalla. */
export const DIPLOMA_CANDIDATE_QUERY = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    visibleCode: true,
    checkIns: {
      where: { reversedAt: null },
      select: { checkedInAt: true, reversedAt: true },
      orderBy: { checkedInAt: "asc" },
    },
  },
} as const;
