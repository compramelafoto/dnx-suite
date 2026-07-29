import { createHash } from "node:crypto";

/**
 * Orden anónimo estable por jurado.
 * No usa fecha de inscripción/carga, apellido ni ID incremental puro.
 * sortKey = HMAC-like sha256(judgeId|contestId|entryId) → orden lexicográfico estable.
 */
export function stableAnonymousSortKey(input: {
  judgeAccountId: string;
  contestId: string;
  entryId: string;
}): string {
  return createHash("sha256")
    .update(`${input.judgeAccountId}|${input.contestId}|${input.entryId}`, "utf8")
    .digest("hex");
}

export function sortEntriesForJuror<T extends { entryId: string }>(
  rows: T[],
  judgeAccountId: string,
  contestId: string,
): Array<T & { sortKey: string }> {
  return rows
    .map((row) => ({
      ...row,
      sortKey: stableAnonymousSortKey({
        judgeAccountId,
        contestId,
        entryId: row.entryId,
      }),
    }))
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
}
