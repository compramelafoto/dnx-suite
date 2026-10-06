import type { ProjectStatus } from "./constants";

/**
 * La votación de la comisión sobre cada proyecto (diseño §7). Módulo PURO.
 *
 * El voto mide apoyo; la aprobación formal se registra en reunión. Votan quienes tienen un cargo
 * vigente marcado "vota" (Roles §12.1.1). Dentro de la comisión el voto es nominal; el socio ve
 * sólo el total.
 */

export const VOTE_VALUES = ["FOR", "AGAINST"] as const;
export type VoteValue = (typeof VOTE_VALUES)[number];

export function isVoteValue(v: string): v is VoteValue {
  return (VOTE_VALUES as readonly string[]).includes(v);
}

/** La votación está abierta mientras el proyecto espera una decisión. */
const ABIERTA: ReadonlySet<ProjectStatus> = new Set(["PROPOSED", "IN_REVIEW", "POSTPONED"]);

export function isVotingOpen(status: ProjectStatus): boolean {
  return ABIERTA.has(status);
}

export type Tally = {
  for: number;
  against: number;
  notVoted: number;
  eligible: number;
  /** Porcentaje a favor sobre los habilitados (no sobre los que votaron): 2 de 7 no es mayoría. */
  percentFor: number;
};

/**
 * El recuento. Sólo cuentan los votos de quienes hoy están habilitados: si alguien dejó el cargo,
 * su voto deja de pesar (queda en el historial).
 */
export function tally(votes: readonly { voterUserId: number; value: string }[], eligibleUserIds: ReadonlySet<number>, eligibleTotal: number): Tally {
  let aFavor = 0;
  let enContra = 0;
  for (const v of votes) {
    if (!eligibleUserIds.has(v.voterUserId)) continue;
    if (v.value === "FOR") aFavor++;
    else if (v.value === "AGAINST") enContra++;
  }
  const eligible = Math.max(eligibleTotal, aFavor + enContra);
  return {
    for: aFavor,
    against: enContra,
    notVoted: eligible - aFavor - enContra,
    eligible,
    percentFor: eligible === 0 ? 0 : Math.round((aFavor / eligible) * 100),
  };
}

export function tallyLabel(t: Pick<Tally, "for" | "eligible">): string {
  return t.eligible === 0 ? "Sin votación" : `${t.for} de ${t.eligible} a favor`;
}

/**
 * Quiénes votan, a partir de los cargos vigentes: un cargo que vota y un titular con cuenta.
 * Un titular sin cuenta cuenta como habilitado (no votó) pero no puede votar hasta vincularla.
 */
export function votingRoll(
  holders: readonly { votes: boolean; userId: number | null; memberId: string | null; termId: string }[],
): { userIds: Set<number>; total: number } {
  const userIds = new Set<number>();
  const personas = new Set<string>();
  for (const h of holders) {
    if (!h.votes) continue;
    // Una misma persona con dos cargos vota una sola vez.
    personas.add(h.userId !== null ? `u:${h.userId}` : h.memberId ? `m:${h.memberId}` : `t:${h.termId}`);
    if (h.userId !== null) userIds.add(h.userId);
  }
  return { userIds, total: personas.size };
}
