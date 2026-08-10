import { createHash } from "node:crypto";

export function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function hashConfig(input: {
  contestId: string;
  unitKey: string;
  metric: string;
  provider: string;
  startsAt: Date;
  endsAt: Date;
  cutoffPolicy: string;
  roundType: string;
  roundNumber: number;
}): string {
  return sha256Hex(
    [
      input.contestId,
      input.unitKey,
      input.metric,
      input.provider,
      input.startsAt.toISOString(),
      input.endsAt.toISOString(),
      input.cutoffPolicy,
      input.roundType,
      String(input.roundNumber),
    ].join("|"),
  );
}

export function hashCandidates(codes: string[]): string {
  return sha256Hex([...codes].sort().join(","));
}

export function hashFinalSnapshot(
  rows: Array<{ publicCode: string; finalMetricValue: number; finalPosition: number | null }>,
): string {
  const sorted = [...rows].sort((a, b) => a.publicCode.localeCompare(b.publicCode));
  return sha256Hex(
    sorted.map((r) => `${r.publicCode}:${r.finalMetricValue}:${r.finalPosition ?? "null"}`).join("|"),
  );
}

export function candidateIntegrityHash(input: {
  roundId: string;
  publicCode: string;
  finalMetricValue: number;
  cutoffAt: Date;
  observationId: string | null;
}): string {
  return sha256Hex(
    `${input.roundId}|${input.publicCode}|${input.finalMetricValue}|${input.cutoffAt.toISOString()}|${input.observationId ?? ""}`,
  );
}
