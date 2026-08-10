import { createHash } from "node:crypto";

/** Código anónimo estable (mismo criterio que Clickatón, sin dependencia cruzada). */
export function buildAnonymousJuryCode(input: {
  contestId: string;
  categoryId: string;
  entryId: string;
  batchId: string;
  categorySlug?: string | null;
}): string {
  const digest = createHash("sha256")
    .update(`jury-anon:v1:${input.contestId}:${input.categoryId}:${input.entryId}:${input.batchId}`)
    .digest("hex");
  const n = (parseInt(digest.slice(0, 8), 16) % 9000) + 1000;
  // Sufijo de 4 hex: reduce colisiones en @@unique([contestId, anonymousJuryCode])
  // (espacio 9000 solo era insuficiente con lotes grandes / categorías cortas).
  const suffix = digest.slice(8, 12).toUpperCase();
  const prefix =
    (input.categorySlug ?? "CAT").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "CAT";
  return `${prefix}-${n}-${suffix}`;
}

/** Campos prohibidos en payload de jurado. */
export const JURY_FORBIDDEN_FIELDS = [
  "name",
  "firstName",
  "lastName",
  "email",
  "instagram",
  "instagramHandle",
  "argraMembershipNumber",
  "residenceLocality",
  "authorUserId",
  "gpsLatitude",
  "gpsLongitude",
  "gpsAltitude",
  "originalFileName",
  "internalNotes",
  "operatorName",
  "operatorEmail",
  "participantEmail",
  "participantName",
] as const;

export type AnonymousJuryPayload = {
  anonymousCode: string;
  categorySlug: string;
  categoryName: string;
  title: string | null;
  description: string | null;
  juryPreviewAvailable: boolean;
  entryId: string;
};

export function buildAnonymousJuryPayload(input: {
  anonymousCode: string;
  categorySlug: string;
  categoryName: string;
  title: string | null;
  description: string | null;
  hasJuryAsset: boolean;
  entryId: string;
}): AnonymousJuryPayload {
  return {
    anonymousCode: input.anonymousCode,
    categorySlug: input.categorySlug,
    categoryName: input.categoryName,
    title: input.title,
    description: input.description,
    juryPreviewAvailable: input.hasJuryAsset,
    entryId: input.entryId,
  };
}

export function assertAnonymousPayloadClean(payload: Record<string, unknown>): string[] {
  const leaks: string[] = [];
  for (const key of JURY_FORBIDDEN_FIELDS) {
    if (key in payload && payload[key] != null && payload[key] !== "") {
      leaks.push(key);
    }
  }
  return leaks;
}
