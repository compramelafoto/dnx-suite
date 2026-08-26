import { createHash } from "node:crypto";

export type PublicationHashInput = {
  contestId: string;
  batchId: string;
  engineVersion: string;
  ruleSetVersion: number;
  entries: Array<{
    anonymousCode: string;
    categoryId: string;
    scopeKey: string;
    finalPosition: number | null;
    aggregateScore: number | null;
    awardType: string | null;
    resultStatus: string;
  }>;
  finalists: Array<{ anonymousCode: string; categoryId: string; status: string }>;
  winners: Array<{ anonymousCode: string; categoryId: string; awardType: string }>;
  awardsConfigStatus: string;
  rubricStatus: string;
  institutionalStatus: string;
  legalStatus: string;
  publicScoresMode: string;
};

/** Hash determinista sin PII ni storage keys. */
export function buildResultPublicationHash(input: PublicationHashInput): string {
  const entries = [...input.entries].sort((a, b) => {
    const c = a.categoryId.localeCompare(b.categoryId);
    if (c !== 0) return c;
    const s = a.scopeKey.localeCompare(b.scopeKey);
    if (s !== 0) return s;
    return (a.finalPosition ?? 9999) - (b.finalPosition ?? 9999) || a.anonymousCode.localeCompare(b.anonymousCode);
  });
  const finalists = [...input.finalists].sort((a, b) =>
    `${a.categoryId}:${a.anonymousCode}`.localeCompare(`${b.categoryId}:${b.anonymousCode}`),
  );
  const winners = [...input.winners].sort((a, b) =>
    `${a.categoryId}:${a.awardType}:${a.anonymousCode}`.localeCompare(
      `${b.categoryId}:${b.awardType}:${b.anonymousCode}`,
    ),
  );
  const payload = {
    v: 1,
    contestId: input.contestId,
    batchId: input.batchId,
    engineVersion: input.engineVersion,
    ruleSetVersion: input.ruleSetVersion,
    entries,
    finalists,
    winners,
    awardsConfigStatus: input.awardsConfigStatus,
    rubricStatus: input.rubricStatus,
    institutionalStatus: input.institutionalStatus,
    legalStatus: input.legalStatus,
    publicScoresMode: input.publicScoresMode,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
