/**
 * Preparación del sistema de créditos fotográficos (Etapa 9+).
 */

import { buildClfCopyright, buildClfPhotoCredit } from "../clf-credit";

export type CreditsPrep = {
  status: "NOT_READY" | "READY" | "PENDING_REVIEW";
  canAutoCredit: boolean;
  credits: Array<{
    clfUserId: number;
    displayName: string;
    creditLine: string;
    copyrightLine: string;
  }>;
  reasons: string[];
};

export function buildCreditsPrep(input: {
  photographers: Array<{
    clfUserId: number;
    displayName: string;
    companyName?: string | null;
  }>;
  syncStatus: string;
}): CreditsPrep {
  const reasons: string[] = [];
  if (input.syncStatus === "STALE") reasons.push("Cobertura STALE: revisar créditos.");
  if (input.photographers.length === 0) {
    reasons.push("Sin fotógrafos para acreditar.");
  }

  const credits = input.photographers.map((p) => ({
    clfUserId: p.clfUserId,
    displayName: p.displayName,
    creditLine: buildClfPhotoCredit(p.displayName, p.companyName),
    copyrightLine: buildClfCopyright(p.displayName),
  }));

  const canAutoCredit = credits.length > 0;
  return {
    status: canAutoCredit ? (reasons.length ? "PENDING_REVIEW" : "READY") : "NOT_READY",
    canAutoCredit,
    credits,
    reasons,
  };
}
