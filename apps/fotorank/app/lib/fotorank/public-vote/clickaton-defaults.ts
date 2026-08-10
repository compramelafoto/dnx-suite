/**
 * Template/default futuro Clickatón — NO aplica a edición comercial en 17A.
 */
export const CLICKATON_PUBLIC_VOTE_DEFAULTS = {
  mode: "JURY_THEN_PUBLIC" as const,
  publicVoteEnabled: false, // nunca auto-enable comercial
  unit: "PROMPT" as const,
  metric: "LIKE_COUNT" as const,
  durationMinutes: 1440,
  tieBreak: "PUBLIC_REVOTE" as const,
  provider: "NONE" as const, // Instagram llega en 17B
  cutoffPolicy: "LAST_VALID_OBSERVATION_BEFORE_CUTOFF" as const,
  resultsPublicationMode: "CALCULATED" as const,
  finalistsPerUnit: 3,
  expectedUnits: 10,
  expectedCandidates: 30,
} as const;
