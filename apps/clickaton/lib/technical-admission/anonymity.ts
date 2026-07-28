import { createHash } from "node:crypto";

/**
 * Código anónimo estable por concurso + categoría + entry + batch.
 * No usa IDs incrementales de DB ni número público Clickatón.
 */
export function buildAnonymousJuryCode(input: {
  contestId: string;
  categoryId: string;
  entryId: string;
  batchId: string;
  categorySlug?: string | null;
}): string {
  const digest = createHash("sha256")
    .update(
      `jury-anon:v1:${input.contestId}:${input.categoryId}:${input.entryId}:${input.batchId}`,
    )
    .digest("hex");
  const n = (parseInt(digest.slice(0, 8), 16) % 9000) + 1000;
  const prefix = (input.categorySlug ?? "CAT")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6) || "CAT";
  return `${prefix}-${n}`;
}

export const JURY_FORBIDDEN_IDENTITY_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "instagram",
  "instagramHandle",
  "phone",
  "documentNumber",
  "clickatonParticipantNumber",
  "originalFileName",
  "authorUserId",
  "gpsLatitude",
  "gpsLongitude",
] as const;
