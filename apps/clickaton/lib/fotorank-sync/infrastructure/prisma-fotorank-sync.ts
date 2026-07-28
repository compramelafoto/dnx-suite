import { prisma, Prisma } from "@/lib/admin/db";
import {
  classifySyncErrorCode,
  nextRetryAt,
  shouldMoveToManualReview,
} from "../domain/retry";
import {
  FotoRankSyncError,
  type FotoRankValidationStatus,
} from "../domain/types";
import { assertNoFinancialLeak, buildRegistrationPaidEvent } from "../application/fotorank-sync-service";

function idempotencyKeyFor(registrationId: string, contestId: string): string {
  return `fr_sync:${registrationId}:${contestId}`;
}

export async function validateFotoRankContestForEdition(contestId: string): Promise<{
  status: FotoRankValidationStatus;
  title: string | null;
  error: string | null;
}> {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: {
      id: true,
      title: true,
      status: true,
      visibility: true,
      experienceType: true,
      distributionChannel: true,
    },
  });
  if (!contest) {
    return { status: "INVALID", title: null, error: "Concurso inexistente." };
  }
  if (contest.status === "ARCHIVED" || contest.status === "CLOSED") {
    return {
      status: "INVALID",
      title: contest.title,
      error: `Concurso no activo (${contest.status}).`,
    };
  }
  return { status: "VALID", title: contest.title, error: null };
}

export async function updateEditionFotoRankLink(input: {
  editionId: string;
  fotorankContestId: string | null;
  fotoRankSyncEnabled: boolean;
  actorUserId: number;
}): Promise<void> {
  let validationStatus: FotoRankValidationStatus = "NOT_CONFIGURED";
  let validationError: string | null = null;
  if (input.fotorankContestId) {
    const v = await validateFotoRankContestForEdition(input.fotorankContestId);
    validationStatus = v.status;
    validationError = v.error;
  }
  await prisma.clickatonEdition.update({
    where: { id: input.editionId },
    data: {
      fotorankContestId: input.fotorankContestId,
      fotoRankSyncEnabled: input.fotoRankSyncEnabled && validationStatus === "VALID",
      fotoRankSyncMode:
        input.fotoRankSyncEnabled && validationStatus === "VALID" ? "POST_PAID" : "DISABLED",
      fotoRankValidationStatus: !input.fotorankContestId
        ? "NOT_CONFIGURED"
        : input.fotoRankSyncEnabled
          ? validationStatus
          : "DISABLED",
      fotoRankLastValidatedAt: new Date(),
      fotoRankValidationError: validationError,
    },
  });
  console.info(
    JSON.stringify({
      event: "fotorank_edition_link_updated",
      editionId: input.editionId,
      actorUserId: input.actorUserId,
      contestId: input.fotorankContestId,
      validationStatus,
      // sin secretos
    }),
  );
}

/**
 * Encola sync post-PAID. Nunca lanza al caller financiero.
 */
export async function enqueueFotoRankSyncAfterPaid(input: {
  registrationId: string;
  editionId: string;
  userId: number;
  paymentOrderId: string | null;
  paidAt?: Date;
}): Promise<{ ok: boolean; reason?: string; syncId?: string }> {
  try {
    const event = buildRegistrationPaidEvent(input);
    assertNoFinancialLeak(event);

    const edition = await prisma.clickatonEdition.findUnique({
      where: { id: input.editionId },
      select: {
        id: true,
        fotorankContestId: true,
        fotoRankSyncEnabled: true,
        fotoRankSyncMode: true,
      },
    });
    if (!edition) return { ok: false, reason: "EDITION_NOT_FOUND" };
    if (!edition.fotoRankSyncEnabled || edition.fotoRankSyncMode !== "POST_PAID") {
      return { ok: false, reason: "SYNC_DISABLED" };
    }
    if (!edition.fotorankContestId) return { ok: false, reason: "NO_CONTEST" };

    const reg = await prisma.clickatonRegistration.findUnique({
      where: { id: input.registrationId },
      select: { id: true, paymentStatus: true, status: true },
    });
    if (!reg) return { ok: false, reason: "REGISTRATION_NOT_FOUND" };
    if (reg.paymentStatus !== "APPROVED" && reg.status !== "CONFIRMED") {
      return { ok: false, reason: "NOT_PAID" };
    }

    await prisma.clickatonIntegrationOutboxEvent.upsert({
      where: { idempotencyKey: event.idempotencyKey },
      create: {
        editionId: input.editionId,
        eventType: event.eventType,
        aggregateType: "ClickatonRegistration",
        aggregateId: input.registrationId,
        payload: event as unknown as Prisma.InputJsonValue,
        status: "PENDING",
        availableAt: new Date(),
        idempotencyKey: event.idempotencyKey,
      },
      update: {},
    });

    const syncIdem = idempotencyKeyFor(input.registrationId, edition.fotorankContestId);
    const sync = await prisma.clickatonFotoRankSync.upsert({
      where: {
        registrationId_fotoRankContestId: {
          registrationId: input.registrationId,
          fotoRankContestId: edition.fotorankContestId,
        },
      },
      create: {
        editionId: input.editionId,
        registrationId: input.registrationId,
        userId: input.userId,
        fotoRankContestId: edition.fotorankContestId,
        status: "PENDING",
        nextRetryAt: new Date(),
        idempotencyKey: syncIdem,
      },
      update: {},
    });

    await prisma.clickatonRegistration.update({
      where: { id: input.registrationId },
      data: { fotoRankSyncStatus: sync.status },
    });

    return { ok: true, syncId: sync.id };
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "fotorank_sync_enqueue_failed",
        registrationId: input.registrationId,
        reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
      }),
    );
    return {
      ok: false,
      reason: err instanceof Error ? err.message.slice(0, 80) : "enqueue_failed",
    };
  }
}

export async function processFotoRankSyncById(syncId: string): Promise<{
  status: string;
  participantId?: string;
  error?: string;
}> {
  const sync = await prisma.clickatonFotoRankSync.findUnique({ where: { id: syncId } });
  if (!sync) return { status: "NOT_FOUND", error: "sync missing" };
  if (sync.status === "SYNCED") {
    return { status: "SYNCED", participantId: sync.fotoRankParticipantId ?? undefined };
  }

  await prisma.clickatonFotoRankSync.update({
    where: { id: syncId },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  try {
    const contest = await prisma.fotorankContest.findUnique({
      where: { id: sync.fotoRankContestId },
      select: { id: true, status: true },
    });
    if (!contest) throw new FotoRankSyncError("CONTEST_NOT_FOUND", "Concurso inexistente.");
    if (contest.status === "ARCHIVED" || contest.status === "CLOSED") {
      throw new FotoRankSyncError("CONTEST_INACTIVE", `Concurso no activo (${contest.status}).`);
    }

    const reg = await prisma.clickatonRegistration.findUnique({
      where: { id: sync.registrationId },
    });
    if (!reg) throw new FotoRankSyncError("REGISTRATION_MISSING", "Inscripción no encontrada.");
    if (reg.paymentStatus !== "APPROVED") {
      throw new FotoRankSyncError("NOT_PAID", "Inscripción no PAID.");
    }

    // Identidad: userId compartido DNX; email como verificación.
    const user = await prisma.user.findUnique({
      where: { id: sync.userId },
      select: { id: true, email: true },
    });
    if (!user) {
      const byEmail = await prisma.user.findFirst({
        where: { email: { equals: reg.email, mode: "insensitive" } },
        select: { id: true, email: true },
      });
      if (!byEmail) {
        throw new FotoRankSyncError("USER_NOT_FOUND", "Usuario DNX no encontrado.");
      }
    }
    const userId = user?.id ?? sync.userId;

    const existingByExt = await prisma.fotorankContestParticipant.findFirst({
      where: {
        contestId: sync.fotoRankContestId,
        externalRegistrationId: reg.id,
      },
    });
    const existingByUser = await prisma.fotorankContestParticipant.findUnique({
      where: {
        contestId_userId: {
          contestId: sync.fotoRankContestId,
          userId,
        },
      },
    });

    let participantId: string;
    if (existingByExt) {
      participantId = existingByExt.id;
      await prisma.fotorankContestParticipant.update({
        where: { id: participantId },
        data: {
          clickatonParticipantNumber: reg.visibleCode,
          sequenceNumber: reg.sequenceNumber,
          instagramHandle: reg.instagramHandle,
          profilePhotoAssetId: reg.profilePhotoAssetId,
          welcomeCardAssetId: reg.welcomeCardAssetId,
          welcomeCardStatus: reg.welcomeCardStatus,
          enabled: true,
          paidAt: reg.confirmedAt,
        },
      });
    } else if (existingByUser) {
      participantId = existingByUser.id;
      await prisma.fotorankContestParticipant.update({
        where: { id: participantId },
        data: {
          externalRegistrationId: reg.id,
          externalEditionId: reg.editionId,
          externalUserId: String(userId),
          clickatonParticipantNumber: reg.visibleCode,
          sequenceNumber: reg.sequenceNumber,
          sourcePlatform: "CLICKATON",
          firstNameSnapshot: reg.firstName,
          lastNameSnapshot: reg.lastName,
          emailSnapshot: reg.email,
          phoneSnapshot: reg.phone,
          citySnapshot: reg.city,
          provinceSnapshot: reg.province,
          countrySnapshot: reg.country,
          instagramHandle: reg.instagramHandle,
          profilePhotoAssetId: reg.profilePhotoAssetId,
          welcomeCardAssetId: reg.welcomeCardAssetId,
          welcomeCardStatus: reg.welcomeCardStatus,
          paidAt: reg.confirmedAt,
          enabled: true,
        },
      });
    } else {
      const created = await prisma.fotorankContestParticipant.create({
        data: {
          contestId: sync.fotoRankContestId,
          userId,
          clickatonParticipantNumber: reg.visibleCode,
          sequenceNumber: reg.sequenceNumber,
          sourcePlatform: "CLICKATON",
          externalRegistrationId: reg.id,
          externalEditionId: reg.editionId,
          externalUserId: String(userId),
          firstNameSnapshot: reg.firstName,
          lastNameSnapshot: reg.lastName,
          emailSnapshot: reg.email,
          phoneSnapshot: reg.phone,
          citySnapshot: reg.city,
          provinceSnapshot: reg.province,
          countrySnapshot: reg.country,
          instagramHandle: reg.instagramHandle,
          profilePhotoAssetId: reg.profilePhotoAssetId,
          welcomeCardAssetId: reg.welcomeCardAssetId,
          welcomeCardStatus: reg.welcomeCardStatus,
          enabled: true,
          paidAt: reg.confirmedAt,
          metadata: {
            origin: "CLICKATON",
            // sin datos financieros
          },
        },
      });
      participantId = created.id;
    }

    await prisma.clickatonFotoRankSync.update({
      where: { id: syncId },
      data: {
        status: "SYNCED",
        fotoRankParticipantId: participantId,
        completedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        nextRetryAt: null,
        userId,
      },
    });
    await prisma.clickatonRegistration.update({
      where: { id: reg.id },
      data: {
        fotoRankParticipantId: participantId,
        fotoRankSyncStatus: "SYNCED",
        fotoRankSyncedAt: new Date(),
      },
    });
    await prisma.clickatonIntegrationOutboxEvent.updateMany({
      where: {
        aggregateId: reg.id,
        eventType: "CLICKATON_REGISTRATION_PAID",
        status: { in: ["PENDING", "PROCESSING", "FAILED"] },
      },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    return { status: "SYNCED", participantId };
  } catch (err) {
    const code = err instanceof FotoRankSyncError ? err.code : "TEMPORARY";
    const message = err instanceof Error ? err.message.slice(0, 200) : "unknown";
    const errorClass =
      err instanceof FotoRankSyncError ? err.errorClass : classifySyncErrorCode(code);
    const attemptCount = sync.attemptCount + 1;
    const manual = shouldMoveToManualReview(attemptCount, errorClass);
    const status = manual ? "MANUAL_REVIEW" : "RETRY_PENDING";
    await prisma.clickatonFotoRankSync.update({
      where: { id: syncId },
      data: {
        status,
        lastErrorCode: code,
        lastErrorMessage: message,
        nextRetryAt: manual ? null : nextRetryAt(attemptCount),
      },
    });
    await prisma.clickatonRegistration.update({
      where: { id: sync.registrationId },
      data: { fotoRankSyncStatus: status },
    });
    return { status, error: `${code}:${message}` };
  }
}

export async function processDueFotoRankSyncs(limit = 25): Promise<number> {
  const due = await prisma.clickatonFotoRankSync.findMany({
    where: {
      status: { in: ["PENDING", "RETRY_PENDING"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const row of due) {
    await processFotoRankSyncById(row.id);
  }
  return due.length;
}

export async function getEditionFotoRankSyncStats(editionId: string) {
  const groups = await prisma.clickatonFotoRankSync.groupBy({
    by: ["status"],
    where: { editionId },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const g of groups) counts[g.status] = g._count._all;
  return counts;
}
