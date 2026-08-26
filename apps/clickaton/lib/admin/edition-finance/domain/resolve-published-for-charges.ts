/**
 * Cobros reales / gate / snapshot: únicamente la distribución publicada vigente.
 * Los borradores NUNCA determinan si la edición puede cobrar.
 */

export type DistributionVersionRef = {
  id: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED" | string;
};

export type AgreementRefForCharges = {
  id: string;
  status: string;
  currentVersionId: string | null;
};

export type ResolvePublishedForChargesResult<TVersion extends DistributionVersionRef> =
  | {
      ok: true;
      version: TVersion;
      usedFallback: boolean;
      reason: "current_published" | "fallback_latest_published";
    }
  | {
      ok: false;
      version: null;
      usedFallback: false;
      reason:
        | "no_agreement"
        | "agreement_not_active"
        | "no_published_version"
        | "current_points_to_non_published_without_fallback";
    };

/**
 * Elige la versión a usar para cobros.
 * - Preferencia: `currentVersionId` si está PUBLISHED.
 * - Si `currentVersionId` apunta a DRAFT/SUPERSEDED, cae al PUBLISHED más reciente
 *   (nunca al borrador).
 * - Si el acuerdo no está ACTIVE → no hay cobros.
 */
export function resolvePublishedVersionForCharges<TVersion extends DistributionVersionRef>(input: {
  agreement: AgreementRefForCharges | null | undefined;
  /** Versión apuntada por currentVersionId (si existe). */
  currentVersion: TVersion | null | undefined;
  /** Todas las versiones del acuerdo (o al menos las PUBLISHED). */
  versions: TVersion[];
}): ResolvePublishedForChargesResult<TVersion> {
  const agreement = input.agreement;
  if (!agreement) {
    return { ok: false, version: null, usedFallback: false, reason: "no_agreement" };
  }
  if (agreement.status !== "ACTIVE") {
    return {
      ok: false,
      version: null,
      usedFallback: false,
      reason: "agreement_not_active",
    };
  }

  const current = input.currentVersion ?? null;
  if (current && current.status === "PUBLISHED") {
    return {
      ok: true,
      version: current,
      usedFallback: false,
      reason: "current_published",
    };
  }

  const published = input.versions
    .filter((v) => v.status === "PUBLISHED")
    .sort((a, b) => b.versionNumber - a.versionNumber);

  const latestPublished = published[0] ?? null;
  if (latestPublished) {
    return {
      ok: true,
      version: latestPublished,
      usedFallback: true,
      reason: "fallback_latest_published",
    };
  }

  if (current && current.status !== "PUBLISHED") {
    return {
      ok: false,
      version: null,
      usedFallback: false,
      reason: "current_points_to_non_published_without_fallback",
    };
  }

  return {
    ok: false,
    version: null,
    usedFallback: false,
    reason: "no_published_version",
  };
}

/** True si una mutación de borrador no debe tocar paymentAccountId de un participante usado por la PUBLISHED vigente. */
export function shouldFreezeParticipantAccountForDraft(input: {
  writingVersionStatus: string;
  publishedVersionId: string | null | undefined;
  publishedVersionStatus: string | null | undefined;
  participantUsedByPublished: boolean;
}): boolean {
  if (input.writingVersionStatus !== "DRAFT") return false;
  if (!input.publishedVersionId || input.publishedVersionStatus !== "PUBLISHED") {
    return false;
  }
  return input.participantUsedByPublished;
}
