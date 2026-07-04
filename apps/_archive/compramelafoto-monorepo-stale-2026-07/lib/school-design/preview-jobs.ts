import {
  DesignPreviewJobStatus,
  DesignPreviewStatus,
  DesignProjectStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertNoActivePreviewJob } from "./review-actions";

export const PREVIEW_MAX_WIDTH = 1600;

/**
 * Encola render de preview; deduplica PENDING/PROCESSING por revisión.
 */
export async function enqueueDesignPreviewJob(input: { designProjectId: number; designRevisionId: number }) {
  const ok = await assertNoActivePreviewJob(input.designRevisionId);
  if (!ok) {
    console.warn("[school_design_preview_job] duplicate active job blocked", input);
    return { ok: false as const, code: "DUPLICATE_JOB" };
  }

  const dp = await prisma.designProject.findUnique({ where: { id: input.designProjectId } });
  if (!dp) {
    return { ok: false as const, code: "NOT_FOUND" };
  }

  const nextVersion = (dp.previewVersion ?? 0) + 1;

  await prisma.$transaction([
    prisma.designProject.update({
      where: { id: input.designProjectId },
      data: {
        previewVersion: nextVersion,
        previewStatus: DesignPreviewStatus.RENDERING,
        previewDirty: false,
        previewError: null,
        status: DesignProjectStatus.DRAFT_RENDERING,
      },
    }),
    prisma.designPreviewJob.create({
      data: {
        designRevisionId: input.designRevisionId,
        status: DesignPreviewJobStatus.PENDING,
        targetVersion: nextVersion,
      },
    }),
  ]);

  console.log("[school_design_preview_job] enqueued", { ...input, nextVersion });
  return { ok: true as const, previewVersion: nextVersion };
}

export async function pickNextPreviewJob() {
  return prisma.designPreviewJob.findFirst({
    where: { status: DesignPreviewJobStatus.PENDING },
    orderBy: { createdAt: "asc" },
    include: {
      designRevision: {
        include: {
          designProject: { include: { template: { include: { slots: true } } } },
        },
      },
    },
  });
}

export async function markPreviewJobProcessing(id: string) {
  return prisma.designPreviewJob.update({
    where: { id },
    data: {
      status: DesignPreviewJobStatus.PROCESSING,
      startedAt: new Date(),
    },
  });
}

export async function markPreviewJobFailed(id: string, error: string) {
  await prisma.designPreviewJob.update({
    where: { id },
    data: {
      status: DesignPreviewJobStatus.FAILED,
      error,
      completedAt: new Date(),
    },
  });
}

export async function markPreviewJobCompleted(id: string) {
  await prisma.designPreviewJob.update({
    where: { id },
    data: {
      status: DesignPreviewJobStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
}
