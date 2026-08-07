import { Prisma, prisma } from "@repo/db";
import {
  buildPartnerBenefitSyncEventKey,
  type PartnerBenefitSyncEventPayload,
  type PartnerBenefitSyncEventType,
} from "@repo/partners";
import { logAutoSync } from "./log";

export type TxClient = Prisma.TransactionClient;

const AGGREGATE = {
  registration: "ClickatonRegistration",
  benefit: "DnxPartnerBenefit",
  prize: "ClickatonPrizeAssignment",
  edition: "ClickatonEdition",
} as const;

function resolveAggregate(payload: PartnerBenefitSyncEventPayload): {
  type: string;
  id: string;
} {
  if (payload.benefitId) {
    return { type: AGGREGATE.benefit, id: payload.benefitId };
  }
  if (payload.prizeAssignmentId) {
    return { type: AGGREGATE.prize, id: payload.prizeAssignmentId };
  }
  if (payload.registrationId) {
    return { type: AGGREGATE.registration, id: payload.registrationId };
  }
  return { type: AGGREGATE.edition, id: payload.editionId };
}

function buildWinnerVersionToken(winnerVersion: number, versionSuffix?: string): string {
  const base = `v${winnerVersion}`;
  const suffix = versionSuffix?.trim();
  return suffix ? `${base}:${suffix}` : base;
}

/**
 * Encola en outbox dentro de una transacción. Lanza si falla.
 */
export async function enqueuePartnerBenefitSyncEventInTx(
  tx: TxClient,
  payload: PartnerBenefitSyncEventPayload,
): Promise<{ ok: true; duplicate: boolean; eventId: string }> {
  if (!payload.editionId) {
    throw new Error("MISSING_EDITION");
  }
  const eventKey = buildPartnerBenefitSyncEventKey(payload);
  const aggregate = resolveAggregate(payload);

  const row = await tx.clickatonIntegrationOutboxEvent.upsert({
    where: { idempotencyKey: eventKey },
    create: {
      editionId: payload.editionId,
      eventType: payload.eventType,
      aggregateType: aggregate.type,
      aggregateId: aggregate.id,
      payload: payload as unknown as Prisma.InputJsonValue,
      status: "PENDING",
      availableAt: new Date(),
      idempotencyKey: eventKey,
    },
    update: {},
  });

  const created = row.createdAt.getTime() === row.updatedAt.getTime();

  if (row.status !== "PENDING" && row.processedAt) {
    logAutoSync("event_duplicate_ignored", {
      eventType: payload.eventType,
      eventKey,
      status: row.status,
    });
    return { ok: true, duplicate: true, eventId: row.id };
  }

  await tx.dnxPartnerAuditEvent.create({
    data: {
      partnerId: null,
      entityType: "PartnerBenefitSyncEvent",
      entityId: row.id,
      action: created ? "auto_sync.event_created" : "auto_sync.event_upsert",
      actorUserId: null,
      summary: `${payload.eventType} edition=${payload.editionId}`,
      afterJson: {
        eventType: payload.eventType,
        editionId: payload.editionId,
        registrationId: payload.registrationId ?? null,
        benefitId: payload.benefitId ?? null,
        prizeAssignmentId: payload.prizeAssignmentId ?? null,
        prizeBundleId: payload.prizeBundleId ?? null,
        winnerVersion: payload.winnerVersion ?? null,
        versionToken: payload.versionToken ?? null,
      },
    },
  });

  logAutoSync("event_created", {
    eventType: payload.eventType,
    eventKey,
    eventId: row.id,
    editionId: payload.editionId,
  });
  return { ok: true, duplicate: !created && row.status === "PENDING", eventId: row.id };
}

/**
 * Soft-fail: nunca lanza; wrapper sobre InTx con el client root.
 */
export async function enqueuePartnerBenefitSyncEvent(
  payload: PartnerBenefitSyncEventPayload,
): Promise<{ ok: boolean; duplicate?: boolean; eventId?: string; reason?: string }> {
  try {
    return await enqueuePartnerBenefitSyncEventInTx(
      prisma as unknown as TxClient,
      payload,
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 160) : "enqueue_failed";
    logAutoSync("event_enqueue_failed", {
      eventType: payload.eventType,
      reason,
    });
    return { ok: false, reason };
  }
}

export async function enqueueRegistrationConfirmed(input: {
  registrationId: string;
  editionId: string;
  userId?: number | null;
  versionToken?: string;
}) {
  return enqueuePartnerBenefitSyncEvent({
    eventType: "CLICKATON_REGISTRATION_CONFIRMED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    userId: input.userId ?? undefined,
    versionToken: input.versionToken ?? "confirmed",
  });
}

export async function enqueueRegistrationCancelled(input: {
  registrationId: string;
  editionId: string;
  versionToken?: string;
}) {
  return enqueuePartnerBenefitSyncEvent({
    eventType: "CLICKATON_REGISTRATION_CANCELLED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    versionToken: input.versionToken ?? "cancelled",
  });
}

export async function enqueueRegistrationUserLinked(input: {
  registrationId: string;
  editionId: string;
  userId: number;
  versionToken?: string;
}) {
  return enqueuePartnerBenefitSyncEvent({
    eventType: "CLICKATON_REGISTRATION_USER_LINKED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    userId: input.userId,
    versionToken: input.versionToken ?? `uid:${input.userId}`,
  });
}

export async function enqueuePaymentConfirmed(input: {
  registrationId: string;
  editionId: string;
  paymentOrderId?: string | null;
  userId?: number | null;
}) {
  return enqueuePartnerBenefitSyncEvent({
    eventType: "CLICKATON_PAYMENT_CONFIRMED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    paymentOrderId: input.paymentOrderId ?? undefined,
    userId: input.userId ?? undefined,
    versionToken: input.paymentOrderId ?? "paid",
  });
}

export async function enqueuePaymentReversed(input: {
  registrationId: string;
  editionId: string;
  paymentOrderId?: string | null;
  paymentStatus: string;
}) {
  return enqueuePartnerBenefitSyncEvent({
    eventType: "CLICKATON_PAYMENT_REVERSED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    paymentOrderId: input.paymentOrderId ?? undefined,
    versionToken: `${input.paymentStatus}:${input.paymentOrderId ?? "x"}`,
  });
}

export async function enqueueCategoryChanged(input: {
  registrationId: string;
  editionId: string;
  categoryId: string;
  previousCategoryId?: string | null;
}) {
  return enqueuePartnerBenefitSyncEvent({
    eventType: "CLICKATON_REGISTRATION_CATEGORY_CHANGED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    categoryId: input.categoryId,
    previousCategoryId: input.previousCategoryId ?? undefined,
    versionToken: `${input.previousCategoryId ?? "none"}>${input.categoryId}`,
  });
}

export async function enqueueWinnerConfirmed(input: {
  prizeAssignmentId: string;
  registrationId: string;
  editionId: string;
  winnerVersion: number;
  userId?: number | null;
  prizeBundleId?: string;
  versionSuffix?: string;
}) {
  return enqueuePartnerBenefitSyncEvent({
    eventType: "CLICKATON_WINNER_CONFIRMED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    prizeAssignmentId: input.prizeAssignmentId,
    prizeBundleId: input.prizeBundleId,
    userId: input.userId ?? undefined,
    winnerVersion: input.winnerVersion,
    versionToken: buildWinnerVersionToken(input.winnerVersion, input.versionSuffix),
  });
}

export async function enqueueWinnerRevoked(input: {
  prizeAssignmentId: string;
  registrationId: string;
  editionId: string;
  winnerVersion: number;
  previousWinnerRegistrationId?: string | null;
  prizeBundleId?: string;
  versionSuffix?: string;
}) {
  return enqueuePartnerBenefitSyncEvent({
    eventType: "CLICKATON_WINNER_REVOKED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    prizeAssignmentId: input.prizeAssignmentId,
    prizeBundleId: input.prizeBundleId,
    previousWinnerRegistrationId: input.previousWinnerRegistrationId ?? undefined,
    winnerVersion: input.winnerVersion,
    versionToken: buildWinnerVersionToken(input.winnerVersion, input.versionSuffix),
  });
}

/** Variantes InTx para el write path canónico de premios. */
export async function enqueueWinnerConfirmedInTx(
  tx: TxClient,
  input: {
    prizeAssignmentId: string;
    registrationId: string;
    editionId: string;
    winnerVersion: number;
    userId?: number | null;
    prizeBundleId?: string;
    versionSuffix?: string;
  },
) {
  return enqueuePartnerBenefitSyncEventInTx(tx, {
    eventType: "CLICKATON_WINNER_CONFIRMED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    prizeAssignmentId: input.prizeAssignmentId,
    prizeBundleId: input.prizeBundleId,
    userId: input.userId ?? undefined,
    winnerVersion: input.winnerVersion,
    versionToken: buildWinnerVersionToken(input.winnerVersion, input.versionSuffix),
  });
}

export async function enqueueWinnerRevokedInTx(
  tx: TxClient,
  input: {
    prizeAssignmentId: string;
    registrationId: string;
    editionId: string;
    winnerVersion: number;
    previousWinnerRegistrationId?: string | null;
    prizeBundleId?: string;
    versionSuffix?: string;
  },
) {
  return enqueuePartnerBenefitSyncEventInTx(tx, {
    eventType: "CLICKATON_WINNER_REVOKED",
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    registrationId: input.registrationId,
    prizeAssignmentId: input.prizeAssignmentId,
    prizeBundleId: input.prizeBundleId,
    previousWinnerRegistrationId: input.previousWinnerRegistrationId ?? undefined,
    winnerVersion: input.winnerVersion,
    versionToken: buildWinnerVersionToken(input.winnerVersion, input.versionSuffix),
  });
}

export async function enqueueBenefitChange(input: {
  eventType: Extract<
    PartnerBenefitSyncEventType,
    | "PARTNER_BENEFIT_ACTIVATED"
    | "PARTNER_BENEFIT_PAUSED"
    | "PARTNER_BENEFIT_ARCHIVED"
    | "PARTNER_BENEFIT_AUDIENCE_CHANGED"
    | "PARTNER_BENEFIT_VALIDITY_CHANGED"
  >;
  benefitId: string;
  editionId: string;
  versionToken?: string;
}) {
  return enqueuePartnerBenefitSyncEvent({
    eventType: input.eventType,
    occurredAt: new Date().toISOString(),
    editionId: input.editionId,
    benefitId: input.benefitId,
    versionToken: input.versionToken ?? new Date().toISOString(),
  });
}
