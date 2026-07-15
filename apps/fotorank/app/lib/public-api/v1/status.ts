import type {
  FotorankPublicEventStatusV1,
  FotorankPublicRegistrationStatusV1,
  FotorankPublicResultsStatusV1,
} from "./contracts";

/** Estados internos Prisma / legacy. */
export type InternalContestStatus =
  | "DRAFT"
  | "SETUP_IN_PROGRESS"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "ACTIVE"
  | "CLOSED"
  | "ARCHIVED"
  | string;

const PUBLIC_LISTABLE_INTERNAL = new Set(["PUBLISHED", "ACTIVE"]);

export function isInternallyPublicListableStatus(status: InternalContestStatus): boolean {
  return PUBLIC_LISTABLE_INTERNAL.has(status);
}

/** ACTIVE (legacy) → published. */
export function mapInternalStatusToPublic(
  status: InternalContestStatus,
): FotorankPublicEventStatusV1 {
  switch (status) {
    case "PUBLISHED":
    case "ACTIVE":
      return "published";
    case "CLOSED":
      return "closed";
    case "ARCHIVED":
      return "archived";
    case "DRAFT":
    case "SETUP_IN_PROGRESS":
    case "READY_TO_PUBLISH":
    default:
      return "draft";
  }
}

export function deriveRegistrationStatus(input: {
  now?: Date;
  startAt: Date | null;
  submissionDeadline: Date | null;
  eventStatus: FotorankPublicEventStatusV1;
}): FotorankPublicRegistrationStatusV1 {
  if (input.eventStatus === "draft" || input.eventStatus === "archived") {
    return "not_open";
  }
  if (input.eventStatus === "closed") {
    return "closed";
  }

  const now = input.now ?? new Date();
  const deadline = input.submissionDeadline;
  const start = input.startAt;

  if (deadline && deadline.getTime() < now.getTime()) {
    return "closed";
  }
  if (start && start.getTime() > now.getTime()) {
    return "not_open";
  }
  if (deadline || start) {
    return "open";
  }
  return "unknown";
}

/**
 * Sin payload público de ranking aún:
 * - resultsAt futuro → scheduled
 * - resultsAt pasado → pending_publication (datos internos pueden existir)
 * - sin fecha → not_available
 */
export function deriveResultsStatus(input: {
  now?: Date;
  resultsAt: Date | null;
}): FotorankPublicResultsStatusV1 {
  if (!input.resultsAt) return "not_available";
  const now = input.now ?? new Date();
  if (input.resultsAt.getTime() > now.getTime()) return "scheduled";
  return "pending_publication";
}

export function toIsoOrNull(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}
