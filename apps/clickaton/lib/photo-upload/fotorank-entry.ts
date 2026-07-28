/**
 * Adapter: crea/actualiza FotorankContestEntry para una consigna Clickatón.
 * No requiere inscripción nativa FR (registrationId null).
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/admin/db";
import { PhotoUploadError } from "./errors";

function newId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

async function resolveCategoryId(contestId: string, preferredCategoryId?: string | null) {
  if (preferredCategoryId) {
    const cat = await prisma.fotorankContestCategory.findFirst({
      where: { id: preferredCategoryId, contestId, status: "ACTIVE" },
      select: { id: true },
    });
    if (cat) return cat.id;
  }
  const general = await prisma.fotorankContestCategory.findFirst({
    where: { contestId, status: "ACTIVE", OR: [{ slug: "general" }, { slug: "maratón" }, { slug: "marathon" }] },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  if (general) return general.id;
  const first = await prisma.fotorankContestCategory.findFirst({
    where: { contestId, status: "ACTIVE" },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!first) {
    throw new PhotoUploadError(
      "FOTORANK_CATEGORY_MISSING",
      "El concurso FotoRank no tiene categorías activas para vincular la obra.",
      409,
    );
  }
  return first.id;
}

export async function ensureFotorankEntryForPrompt(input: {
  contestId: string;
  authorUserId: number;
  editionId: string;
  registrationId: string;
  promptId: string;
  fotorankParticipantId: string | null;
  clickatonParticipantNumber: string | null;
  preferredCategoryId?: string | null;
  windows: {
    captureStartsAt: Date | null;
    captureEndsAt: Date | null;
    uploadStartsAt: Date | null;
    uploadEndsAt: Date | null;
  };
}): Promise<{ entryId: string; created: boolean }> {
  const existing = await prisma.fotorankContestEntry.findUnique({
    where: {
      contestId_externalRegistrationId_externalPromptId: {
        contestId: input.contestId,
        externalRegistrationId: input.registrationId,
        externalPromptId: input.promptId,
      },
    },
    select: { id: true, status: true },
  });
  if (existing) {
    await prisma.fotorankContestEntry.update({
      where: { id: existing.id },
      data: {
        authorUserId: input.authorUserId,
        externalParticipantId: input.fotorankParticipantId,
        clickatonParticipantNumber: input.clickatonParticipantNumber,
        captureWindowStartsAtSnapshot: input.windows.captureStartsAt,
        captureWindowEndsAtSnapshot: input.windows.captureEndsAt,
        uploadWindowStartsAtSnapshot: input.windows.uploadStartsAt,
        uploadWindowEndsAtSnapshot: input.windows.uploadEndsAt,
        status:
          existing.status === "REPLACED" || existing.status === "WITHDRAWN"
            ? "DRAFT"
            : existing.status,
      },
    });
    return { entryId: existing.id, created: false };
  }

  const categoryId = await resolveCategoryId(input.contestId, input.preferredCategoryId);
  const created = await prisma.fotorankContestEntry.create({
    data: {
      id: newId(),
      contestId: input.contestId,
      categoryId,
      authorUserId: input.authorUserId,
      registrationId: null,
      status: "DRAFT",
      imageUrl: "",
      sourcePlatform: "CLICKATON",
      externalEditionId: input.editionId,
      externalRegistrationId: input.registrationId,
      externalPromptId: input.promptId,
      externalParticipantId: input.fotorankParticipantId,
      clickatonParticipantNumber: input.clickatonParticipantNumber,
      captureWindowStartsAtSnapshot: input.windows.captureStartsAt,
      captureWindowEndsAtSnapshot: input.windows.captureEndsAt,
      uploadWindowStartsAtSnapshot: input.windows.uploadStartsAt,
      uploadWindowEndsAtSnapshot: input.windows.uploadEndsAt,
    },
    select: { id: true },
  });
  return { entryId: created.id, created: true };
}

export async function markFotorankEntryConfirmed(input: {
  entryId: string;
  declarationVersion: string;
  declaredAt: Date;
}) {
  await prisma.fotorankContestEntry.update({
    where: { id: input.entryId },
    data: {
      status: "READY_TO_CONFIRM",
      submittedAt: input.declaredAt,
      confirmedAt: null,
      participantDeclarationAcceptedAt: input.declaredAt,
      participantDeclarationVersion: input.declarationVersion,
      // No CONFIRMED/entryNumber todavía → jurado no ve la obra.
      technicalSummaryStatus: "REQUIRES_REVIEW",
      manualReviewStatus: "PENDING",
    },
  });
}

/** Tras confirmación del participante: SUBMITTED técnico sin liberar a jurado. */
export async function finalizeParticipantConfirmation(input: {
  entryId: string;
  technicalSummaryStatus: "APPROVED" | "APPROVED_WITH_WARNINGS" | "REQUIRES_REVIEW" | "TECHNICALLY_REJECTED";
}) {
  const status =
    input.technicalSummaryStatus === "TECHNICALLY_REJECTED"
      ? "REJECTED"
      : input.technicalSummaryStatus === "REQUIRES_REVIEW"
        ? "REQUIRES_REVIEW"
        : "READY_TO_CONFIRM";

  await prisma.fotorankContestEntry.update({
    where: { id: input.entryId },
    data: {
      status,
      submittedAt: new Date(),
      technicalSummaryStatus: input.technicalSummaryStatus,
      // Jurado solo con CONFIRMED + entryNumber (flujo organizador posterior).
    },
  });
}
