/**
 * Traducción única de estados FotoRank Public V1 → estados visibles Clickaton.
 */

import type {
  MarathonStatus,
  RegistrationStatus,
  ResultsStatus,
  GalleryStatus,
} from "@/types/marathon";
import type {
  FotorankPublicCapabilitiesV1,
  FotorankPublicEventStatusV1,
  FotorankPublicRegistrationStatusV1,
  FotorankPublicResultsStatusV1,
} from "@/data/public-marathons/fotorank-v1-types";

/**
 * Ciclo de vida de ficha (badge principal).
 * No inventa "cancelada": el contrato V1 no la expone.
 */
export function mapFotorankStatusToMarathonStatus(input: {
  status: FotorankPublicEventStatusV1;
  registrationStatus: FotorankPublicRegistrationStatusV1;
  resultsStatus: FotorankPublicResultsStatusV1;
  schedule?: {
    startAt: string | null;
    submissionDeadline: string | null;
    judgingStartAt: string | null;
    judgingEndAt: string | null;
  };
  now?: Date;
}): MarathonStatus {
  const { status, registrationStatus, resultsStatus } = input;
  const now = input.now ?? new Date();

  if (status === "draft") return "draft";
  if (status === "archived") return "archived";

  if (resultsStatus === "published") return "results_published";

  if (status === "closed") {
    if (isInJudgingWindow(input.schedule, now)) return "judging";
    return "judging";
  }

  // published
  if (isInProgressWindow(input.schedule, now)) return "in_progress";
  if (isInJudgingWindow(input.schedule, now)) return "judging";

  if (registrationStatus === "open") return "registration_open";
  if (registrationStatus === "closed") return "registration_closed";

  return "announced";
}

export function mapFotorankRegistrationStatus(
  status: FotorankPublicRegistrationStatusV1,
): RegistrationStatus {
  switch (status) {
    case "not_open":
      return "coming_soon";
    case "open":
      return "open";
    case "closed":
      return "closed";
    case "full":
      return "closed";
    case "cancelled":
    case "finished":
    case "unknown":
    default:
      return "unavailable";
  }
}

export function mapFotorankResultsStatus(
  status: FotorankPublicResultsStatusV1,
): ResultsStatus {
  switch (status) {
    case "published":
      return "published";
    case "scheduled":
    case "pending_publication":
      return "pending";
    case "not_available":
    default:
      return "not_available";
  }
}

export function mapFotorankGalleryStatus(
  capabilities: FotorankPublicCapabilitiesV1,
): GalleryStatus {
  if (capabilities.canViewGallery) return "published";
  return "not_available";
}

function parseIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isInProgressWindow(
  schedule:
    | {
        startAt: string | null;
        submissionDeadline: string | null;
      }
    | undefined,
  now: Date,
): boolean {
  if (!schedule) return false;
  const start = parseIso(schedule.startAt);
  const end = parseIso(schedule.submissionDeadline);
  if (!start) return false;
  if (now < start) return false;
  if (end && now > end) return false;
  return true;
}

function isInJudgingWindow(
  schedule:
    | {
        judgingStartAt: string | null;
        judgingEndAt: string | null;
      }
    | undefined,
  now: Date,
): boolean {
  if (!schedule) return false;
  const start = parseIso(schedule.judgingStartAt);
  const end = parseIso(schedule.judgingEndAt);
  if (!start) return false;
  if (now < start) return false;
  if (end && now > end) return false;
  return true;
}
