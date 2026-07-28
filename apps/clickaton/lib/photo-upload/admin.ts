"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { PhotoUploadError } from "./errors";

export async function adminReviewSubmissionAction(
  editionId: string,
  submissionId: string,
  formData: FormData,
) {
  const user = await requireClickatonAdmin();
  const decision = String(formData.get("decision") ?? "");
  const notes = String(formData.get("notes") ?? "").slice(0, 500);

  const submission = await prisma.clickatonPhotoSubmission.findFirst({
    where: { id: submissionId, editionId },
  });
  if (!submission) throw new PhotoUploadError("NOT_FOUND", "Envío no encontrado.", 404);

  if (decision === "APPROVE") {
    await prisma.clickatonPhotoSubmission.update({
      where: { id: submissionId },
      data: { validationResult: "PASS", status: submission.status === "REJECTED" ? "PENDING_CONFIRMATION" : submission.status },
    });
    if (submission.fotorankEntryId) {
      await prisma.fotorankContestEntry.update({
        where: { id: submission.fotorankEntryId },
        data: {
          manualReviewStatus: "APPROVED",
          technicalSummaryStatus: "APPROVED_WITH_WARNINGS",
        },
      });
    }
  } else if (decision === "REJECT") {
    await prisma.clickatonPhotoSubmission.update({
      where: { id: submissionId },
      data: { validationResult: "FAIL", status: "REJECTED", failureMessage: notes || "Rechazado por organización." },
    });
    if (submission.fotorankEntryId) {
      await prisma.fotorankContestEntry.update({
        where: { id: submission.fotorankEntryId },
        data: {
          manualReviewStatus: "REJECTED",
          technicalSummaryStatus: "TECHNICALLY_REJECTED",
          status: "REJECTED",
        },
      });
    }
  } else if (decision === "MANUAL_REVIEW") {
    await prisma.clickatonPhotoSubmission.update({
      where: { id: submissionId },
      data: { validationResult: "MANUAL_REVIEW" },
    });
    if (submission.fotorankEntryId) {
      await prisma.fotorankContestEntry.update({
        where: { id: submission.fotorankEntryId },
        data: { manualReviewStatus: "PENDING", technicalSummaryStatus: "REQUIRES_REVIEW" },
      });
    }
  } else {
    throw new PhotoUploadError("INVALID_DECISION", "Decisión inválida.", 400);
  }

  await prisma.clickatonPhotoSubmissionAudit.create({
    data: {
      submissionId,
      actorUserId: user.id,
      action: `ADMIN_${decision}`,
      payload: { notes },
    },
  });

  revalidatePath(`${adminRoutes.editions}/${editionId}/envios`);
}

export async function ensureUploadConfigAction(editionId: string) {
  await requireClickatonAdmin();
  await prisma.clickatonEditionUploadConfig.upsert({
    where: { editionId },
    create: { editionId, uploadsEnabled: false },
    update: {},
  });
  revalidatePath(`${adminRoutes.editions}/${editionId}/envios`);
}
