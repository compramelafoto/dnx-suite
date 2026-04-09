import { ExportJobStatus, DesignProjectStatus, DesignPreviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertNoActiveExportJob } from "./review-actions";

export const EXPORT_MAX_WIDTH = 3600;

/**
 * Encola export JPG final; validaciones de negocio en la ruta HTTP.
 */
export async function enqueueDesignExportJob(input: {
  designProjectId: number;
  designRevisionId: number;
}) {
  const ok = await assertNoActiveExportJob(input.designRevisionId);
  if (!ok) {
    console.warn("[school_design_export] duplicate active export job", input);
    return { ok: false as const, code: "DUPLICATE_JOB" };
  }

  const dp = await prisma.designProject.findUnique({ where: { id: input.designProjectId } });
  if (!dp) {
    return { ok: false as const, code: "NOT_FOUND" };
  }

  const nextVersion = (dp.exportVersion ?? 0) + 1;

  await prisma.$transaction([
    prisma.designProject.update({
      where: { id: input.designProjectId },
      data: {
        exportVersion: nextVersion,
        exportError: null,
        status: DesignProjectStatus.EXPORTING,
      },
    }),
    prisma.designExportJob.create({
      data: {
        designProjectId: input.designProjectId,
        designRevisionId: input.designRevisionId,
        status: ExportJobStatus.PENDING,
        targetVersion: nextVersion,
      },
    }),
  ]);

  console.log("[school_design_export] enqueued", { ...input, nextVersion });
  return { ok: true as const, exportVersion: nextVersion };
}

export async function pickNextExportJob() {
  return prisma.designExportJob.findFirst({
    where: { status: ExportJobStatus.PENDING },
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

export async function markExportJobProcessing(id: string) {
  return prisma.designExportJob.update({
    where: { id },
    data: {
      status: ExportJobStatus.PROCESSING,
      startedAt: new Date(),
    },
  });
}

export async function markExportJobFailed(id: string, error: string, designProjectId: number) {
  await prisma.designExportJob.update({
    where: { id },
    data: {
      status: ExportJobStatus.FAILED,
      error,
      completedAt: new Date(),
    },
  });
  await prisma.designProject.update({
    where: { id: designProjectId },
    data: {
      status: DesignProjectStatus.APPROVED_FOR_EXPORT,
      exportError: error,
    },
  });
}

export async function markExportJobCompleted(id: string, designProjectId: number, exportUrlJpg: string) {
  await prisma.designExportJob.update({
    where: { id },
    data: {
      status: ExportJobStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
  await prisma.designProject.update({
    where: { id: designProjectId },
    data: {
      status: DesignProjectStatus.EXPORTED,
      exportUrlJpg,
      exportGeneratedAt: new Date(),
      exportError: null,
      previewStatus: DesignPreviewStatus.READY,
    },
  });
}
