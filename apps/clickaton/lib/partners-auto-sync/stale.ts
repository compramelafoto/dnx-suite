import { prisma } from "@repo/db";
import type { PartnerBenefitSyncEventPayload } from "@repo/partners";
import { readPrizeAssignmentAudit } from "@/lib/admin/prize-assignments/audit";

export type StaleWinnerCheck = {
  stale: boolean;
  reasonCode?: "STALE_VERSION" | "STALE_WINNER_MISMATCH" | "ASSIGNMENT_MISSING";
  currentVersion?: number;
  eventVersion?: number;
};

/**
 * Un evento de ganador es obsoleto si su winnerVersion es menor que la canónica actual.
 * La materialización siempre se basa en el snapshot actual; stale evita re-aplicar ruido.
 */
export async function detectStaleWinnerEvent(
  payload: PartnerBenefitSyncEventPayload,
): Promise<StaleWinnerCheck> {
  if (
    payload.eventType !== "CLICKATON_WINNER_CONFIRMED" &&
    payload.eventType !== "CLICKATON_WINNER_REVOKED"
  ) {
    return { stale: false };
  }
  if (!payload.prizeAssignmentId) {
    return { stale: true, reasonCode: "ASSIGNMENT_MISSING" };
  }

  const assignment = await prisma.clickatonPrizeAssignment.findUnique({
    where: { id: payload.prizeAssignmentId },
    select: {
      auditJson: true,
      winnerRegistrationId: true,
      bundle: { select: { status: true } },
    },
  });
  if (!assignment) {
    return { stale: true, reasonCode: "ASSIGNMENT_MISSING" };
  }

  const currentVersion = readPrizeAssignmentAudit(assignment.auditJson).winnerVersion;
  const eventVersion =
    typeof payload.winnerVersion === "number"
      ? payload.winnerVersion
      : parseVersionToken(payload.versionToken);

  if (eventVersion != null && currentVersion > eventVersion) {
    return {
      stale: true,
      reasonCode: "STALE_VERSION",
      currentVersion,
      eventVersion,
    };
  }

  if (
    payload.eventType === "CLICKATON_WINNER_CONFIRMED" &&
    eventVersion != null &&
    eventVersion === currentVersion
  ) {
    const confirmed =
      assignment.bundle.status === "ASSIGNED" || assignment.bundle.status === "DELIVERED";
    if (
      !confirmed ||
      (payload.registrationId &&
        assignment.winnerRegistrationId &&
        assignment.winnerRegistrationId !== payload.registrationId)
    ) {
      return {
        stale: true,
        reasonCode: "STALE_WINNER_MISMATCH",
        currentVersion,
        eventVersion,
      };
    }
  }

  return { stale: false, currentVersion, eventVersion: eventVersion ?? undefined };
}

function parseVersionToken(token: string | undefined): number | null {
  if (!token) return null;
  const m = /^v(\d+)/.exec(token);
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : null;
}
