import { prisma } from "@repo/db";
import { readPrizeAssignmentAudit } from "./audit";
import type { PrizeAssignmentDecision } from "./state";

export type EditionPrizeOutboxEventRow = {
  id: string;
  eventType: string;
  status: string;
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  idempotencyKey: string;
};

export type EditionPrizeAssignmentRow = {
  bundle: {
    id: string;
    slot: number;
    name: string;
    status: string;
    description: string | null;
    sponsor: string | null;
  };
  assignment: {
    id: string;
    winnerRegistrationId: string | null;
    winnerEntryId: string | null;
    promptId: string | null;
    assignedAt: Date;
    deliveryDueAt: Date | null;
    deliveredAt: Date | null;
    replacedAt: Date | null;
    decision: PrizeAssignmentDecision;
    winnerVersion: number;
  } | null;
  winnerRegistration: {
    id: string;
    userId: number | null;
  } | null;
  latestOutboxEvents: EditionPrizeOutboxEventRow[];
};

/**
 * Filas admin de premios: bundle + assignment + winner (solo ids) + últimos eventos outbox.
 */
export async function listEditionPrizeAssignmentRows(
  editionId: string,
): Promise<EditionPrizeAssignmentRow[]> {
  const bundles = await prisma.clickatonPrizeBundle.findMany({
    where: { editionId },
    orderBy: { slot: "asc" },
    include: {
      assignments: {
        take: 1,
      },
    },
  });

  const assignmentIds = bundles
    .map((b) => b.assignments[0]?.id)
    .filter((id): id is string => Boolean(id));

  const winnerRegIds = [
    ...new Set(
      bundles
        .map((b) => b.assignments[0]?.winnerRegistrationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [regs, outbox] = await Promise.all([
    winnerRegIds.length
      ? prisma.clickatonRegistration.findMany({
          where: { id: { in: winnerRegIds }, editionId },
          select: { id: true, userId: true },
        })
      : Promise.resolve([] as Array<{ id: string; userId: number | null }>),
    assignmentIds.length
      ? prisma.clickatonIntegrationOutboxEvent.findMany({
          where: {
            editionId,
            aggregateType: "ClickatonPrizeAssignment",
            aggregateId: { in: assignmentIds },
            eventType: {
              in: ["CLICKATON_WINNER_CONFIRMED", "CLICKATON_WINNER_REVOKED"],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            eventType: true,
            status: true,
            attempts: true,
            availableAt: true,
            processedAt: true,
            lastError: true,
            createdAt: true,
            idempotencyKey: true,
            aggregateId: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const regById = new Map(regs.map((r) => [r.id, r]));
  const outboxByAssignment = new Map<string, EditionPrizeOutboxEventRow[]>();
  for (const ev of outbox) {
    const list = outboxByAssignment.get(ev.aggregateId) ?? [];
    if (list.length >= 5) continue;
    list.push({
      id: ev.id,
      eventType: ev.eventType,
      status: ev.status,
      attempts: ev.attempts,
      availableAt: ev.availableAt,
      processedAt: ev.processedAt,
      lastError: ev.lastError,
      createdAt: ev.createdAt,
      idempotencyKey: ev.idempotencyKey,
    });
    outboxByAssignment.set(ev.aggregateId, list);
  }

  return bundles.map((bundle) => {
    const assignment = bundle.assignments[0] ?? null;
    const audit = readPrizeAssignmentAudit(assignment?.auditJson);
    const winnerRegistrationId = assignment?.winnerRegistrationId ?? null;
    return {
      bundle: {
        id: bundle.id,
        slot: bundle.slot,
        name: bundle.name,
        status: bundle.status,
        description: bundle.description,
        sponsor: bundle.sponsor,
      },
      assignment: assignment
        ? {
            id: assignment.id,
            winnerRegistrationId: assignment.winnerRegistrationId,
            winnerEntryId: assignment.winnerEntryId,
            promptId: assignment.promptId,
            assignedAt: assignment.assignedAt,
            deliveryDueAt: assignment.deliveryDueAt,
            deliveredAt: assignment.deliveredAt,
            replacedAt: assignment.replacedAt,
            decision: audit.decision,
            winnerVersion: audit.winnerVersion,
          }
        : null,
      winnerRegistration:
        winnerRegistrationId && regById.has(winnerRegistrationId)
          ? {
              id: regById.get(winnerRegistrationId)!.id,
              userId: regById.get(winnerRegistrationId)!.userId,
            }
          : null,
      latestOutboxEvents: assignment
        ? (outboxByAssignment.get(assignment.id) ?? [])
        : [],
    };
  });
}
