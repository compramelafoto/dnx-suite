import {
  DesignPreviewStatus,
  DesignProjectStatus,
  DesignPreviewJobStatus,
  ExportJobStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Marca inicio de export (legacy: transición auxiliar; el flujo canónico usa DesignExportJob).
 */
export async function markExportStarted(designProjectId: number) {
  await prisma.designProject.update({
    where: { id: designProjectId },
    data: {
      status: DesignProjectStatus.EXPORTING,
    },
  });
  console.log("[school_design_export] markExportStarted", { designProjectId });
}

export async function markExportCompleted(designProjectId: number, exportUrlJpg: string) {
  await prisma.designProject.update({
    where: { id: designProjectId },
    data: {
      status: DesignProjectStatus.EXPORTED,
      exportUrlJpg,
      exportGeneratedAt: new Date(),
      exportError: null,
    },
  });
  console.log("[school_design_export] markExportCompleted", { designProjectId });
}

export async function markPreviewRendered(input: {
  designProjectId: number;
  designRevisionId: number;
  previewUrl: string;
  previewVersion: number;
}) {
  await prisma.designProject.update({
    where: { id: input.designProjectId },
    data: {
      previewUrl: input.previewUrl,
      previewStatus: DesignPreviewStatus.READY,
      previewGeneratedAt: new Date(),
      previewVersion: input.previewVersion,
      previewError: null,
      previewDirty: false,
      status: DesignProjectStatus.PENDING_PHOTOGRAPHER_APPROVAL,
    },
  });
  console.log("[school_design_preview] markPreviewRendered", input);
}

export async function approveDesignProject(input: {
  designProjectId: number;
  userId: number;
}) {
  const dp = await prisma.designProject.findUnique({
    where: { id: input.designProjectId },
    include: { currentRevision: true },
  });
  if (!dp?.currentRevisionId || !dp.currentRevision) {
    return { ok: false as const, code: "NO_REVISION", message: "Sin revisión actual" };
  }
  if (dp.status !== DesignProjectStatus.PENDING_PHOTOGRAPHER_APPROVAL) {
    return { ok: false as const, code: "INVALID_STATUS", message: "Estado no permite aprobación" };
  }
  if (dp.previewDirty || dp.previewStatus !== DesignPreviewStatus.READY) {
    console.warn("[school_design_review] approve blocked", {
      designProjectId: input.designProjectId,
      previewDirty: dp.previewDirty,
      previewStatus: dp.previewStatus,
    });
    return { ok: false as const, code: "PREVIEW_NOT_READY", message: "Preview no lista o sucia" };
  }

  await prisma.designProject.update({
    where: { id: input.designProjectId },
    data: {
      status: DesignProjectStatus.APPROVED_FOR_EXPORT,
      approvedAt: new Date(),
      approvedByUserId: input.userId,
      rejectedAt: null,
      rejectedByUserId: null,
      approvedForExportRevisionId: dp.currentRevisionId,
    },
  });
  console.log("[school_design_review] approved", { designProjectId: input.designProjectId, userId: input.userId });
  return { ok: true as const };
}

export async function rejectDesignProject(input: {
  designProjectId: number;
  userId: number;
  reviewReason?: string | null;
  reviewNote?: string | null;
}) {
  const dp = await prisma.designProject.findUnique({ where: { id: input.designProjectId } });
  if (!dp) {
    return { ok: false as const, code: "NOT_FOUND", message: "Proyecto no encontrado" };
  }
  if (dp.status !== DesignProjectStatus.PENDING_PHOTOGRAPHER_APPROVAL) {
    return { ok: false as const, code: "INVALID_STATUS", message: "Estado no permite rechazo" };
  }

  await prisma.designProject.update({
    where: { id: input.designProjectId },
    data: {
      status: DesignProjectStatus.NEEDS_ADJUSTMENT,
      rejectedAt: new Date(),
      rejectedByUserId: input.userId,
      reviewReason: input.reviewReason ?? null,
      reviewNote: input.reviewNote ?? null,
    },
  });
  console.log("[school_design_review] rejected", { designProjectId: input.designProjectId, userId: input.userId });
  return { ok: true as const };
}

/**
 * Solicitar nueva generación de preview desde NEEDS_ADJUSTMENT / DRAFT (tras edición).
 */
export async function requestDesignRegeneration(designProjectId: number) {
  await prisma.designProject.update({
    where: { id: designProjectId },
    data: {
      previewDirty: true,
      previewStatus: DesignPreviewStatus.IDLE,
    },
  });
  console.log("[school_design_review] requestDesignRegeneration", { designProjectId });
}

export async function assertNoActivePreviewJob(designRevisionId: number): Promise<boolean> {
  const j = await prisma.designPreviewJob.findFirst({
    where: {
      designRevisionId,
      status: { in: [DesignPreviewJobStatus.PENDING, DesignPreviewJobStatus.PROCESSING] },
    },
  });
  return !j;
}

export async function assertNoActiveExportJob(designRevisionId: number): Promise<boolean> {
  const j = await prisma.designExportJob.findFirst({
    where: {
      designRevisionId,
      status: { in: [ExportJobStatus.PENDING, ExportJobStatus.PROCESSING] },
    },
  });
  return !j;
}
