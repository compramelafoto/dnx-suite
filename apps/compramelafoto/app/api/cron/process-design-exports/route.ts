import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCronAuth } from "@/lib/cron-auth";
import {
  clearTerminalDesignJobs,
  recoverStaleDesignJobs,
} from "@/lib/school-render/design-job-recovery";
import { renderDesignExport } from "@/lib/school-render/preview-renderer";
import { generateR2Key, uploadToR2 } from "@/lib/r2-client";
import { normalizeEditorDataJson } from "@/lib/school-render/design-editor";
import { ensureFulfillmentQrTokenForPreCompraOrderItem } from "@/lib/school-fulfillment/ensure-fulfillment-qr-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 2;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const recovered = await recoverStaleDesignJobs("export");
  if (recovered.reencolados > 0 || recovered.descartados > 0) {
    console.info("[school_design_export] stale_jobs_recovered", recovered);
  }

  const jobs = await prisma.designExportJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, designRevisionId: true, designProjectId: true },
  });

  let processed = 0;
  for (const job of jobs) {
    const locked = await prisma.designExportJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } },
    });
    if (locked.count !== 1) {
      console.info("[school_design_export] export_job_deduplicated", { jobId: job.id });
      continue;
    }

    // `@@unique([designRevisionId, status])`: si quedó un cierre viejo de esta misma revisión,
    // el cierre de este trabajo chocaría. Se libera el lugar antes de empezar.
    await clearTerminalDesignJobs("export", job.designRevisionId, job.id);

    console.info("[school_design_export] export_job_started", { jobId: job.id });
    const revision = await prisma.designRevision.findUnique({
      where: { id: job.designRevisionId },
      select: { id: true, dataJson: true, designProjectId: true },
    });
    if (!revision) {
      await prisma.designExportJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: "revision_not_found" },
      });
      continue;
    }

    const ctx = await prisma.designProject.findUnique({
      where: { id: revision.designProjectId },
      select: {
        id: true,
        status: true,
        orderItemId: true,
        template: {
          select: { imageUrl: true, widthCm: true, heightCm: true, slots: { select: { id: true, bbox: true } } },
        },
        orderItem: {
          select: {
            selection: {
              select: {
                photos: {
                  select: { id: true, photo: { select: { previewUrl: true, originalKey: true } } },
                },
              },
            },
          },
        },
      },
    });
    const data = normalizeEditorDataJson(revision.dataJson ?? null, {
      templateId: null,
      orderItemId: ctx?.orderItemId ?? null,
    });

    if (ctx?.status !== "EXPORTING") {
      await prisma.designExportJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: "project_not_exporting" },
      });
      console.info("[school_design_export] export_job_failed", { jobId: job.id, err: "project_not_exporting" });
      continue;
    }

    if (data.previewDirty || data.previewStatus !== "READY") {
      data.exportStatus = "FAILED";
      data.exportError = data.previewDirty ? "preview_dirty" : "preview_not_ready";
      await prisma.designRevision.update({
        where: { id: revision.id },
        data: { dataJson: data as any },
      });
      await prisma.designProject.update({
        where: { id: revision.designProjectId },
        data: { status: "APPROVED_FOR_EXPORT" },
      });
      await prisma.designExportJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: data.exportError },
      });
      console.info("[school_design_export] export_job_failed", { jobId: job.id, err: data.exportError });
      continue;
    }

    if (!ctx?.template?.imageUrl || !ctx.template.widthCm || !ctx.template.heightCm) {
      data.exportStatus = "FAILED";
      data.exportError = "template_missing";
      await prisma.designRevision.update({
        where: { id: revision.id },
        data: { dataJson: data as any },
      });
      await prisma.designProject.update({
        where: { id: revision.designProjectId },
        data: { status: "APPROVED_FOR_EXPORT" },
      });
      await prisma.designExportJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: "template_missing" },
      });
      console.info("[school_design_export] export_job_failed", { jobId: job.id, err: "template_missing" });
      continue;
    }

    try {
      const render = await renderDesignExport({
        templateImageUrl: ctx.template.imageUrl,
        templateWidthCm: ctx.template.widthCm,
        templateHeightCm: ctx.template.heightCm,
        slots:
          ctx.template.slots?.map((s) => ({
            id: s.id,
            bbox: s.bbox as { x: number; y: number; width: number; height: number },
          })) ?? [],
        assignments: data.assignments ?? [],
        selectionPhotos:
          ctx.orderItem.selection?.photos?.map((p) => ({
            id: p.id,
            photo: { previewUrl: p.photo.previewUrl, originalKey: p.photo.originalKey },
          })) ?? [],
        slotOverrides: data.slotOverrides ?? {},
        targetWidthPx: 3000,
      });

      if (!render.ok || !render.buffer) {
        data.exportStatus = "FAILED";
        data.exportError = render.error || "render_failed";
        await prisma.designRevision.update({
          where: { id: revision.id },
          data: { dataJson: data as any },
        });
        await prisma.designProject.update({
          where: { id: revision.designProjectId },
          data: { status: "APPROVED_FOR_EXPORT" },
        });
        await prisma.designExportJob.update({
          where: { id: job.id },
          data: { status: "FAILED", lastError: data.exportError },
        });
        console.info("[school_design_export] export_job_failed", { jobId: job.id, err: data.exportError });
        continue;
      }

      const key = generateR2Key(`design-export-${revision.id}.jpg`, "design-exports");
      const upload = await uploadToR2(render.buffer, key, "image/jpeg");
      const nextVersion = (data.exportVersion ?? 0) + 1;
      data.exportStatus = "EXPORTED";
      data.exportGeneratedAt = new Date().toISOString();
      data.exportVersion = nextVersion;
      data.exportUrlJpg = upload.url;
      data.exportWidth = render.width ?? null;
      data.exportHeight = render.height ?? null;
      data.exportError = null;
      await prisma.designRevision.update({
        where: { id: revision.id },
        data: { dataJson: data as any },
      });
      await prisma.designExportJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED" },
      });
      await prisma.designProject.update({
        where: { id: revision.designProjectId },
        data: { status: "EXPORTED" },
      });
      if (ctx.orderItemId != null) {
        await prisma.preCompraOrderItem.update({
          where: { id: ctx.orderItemId },
          data: { status: "EXPORTED" },
        });
        await ensureFulfillmentQrTokenForPreCompraOrderItem(prisma, ctx.orderItemId);
      }
      console.info("[school_design_export] export_job_succeeded", { jobId: job.id });
      console.info("[school_design_export] export_status_exported", { jobId: job.id });
    } catch (err) {
      await prisma.designExportJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: err instanceof Error ? err.message : "render_failed" },
      });
      console.error("[school_design_export] export_job_failed", { jobId: job.id, err });
      data.exportStatus = "FAILED";
      data.exportError = "render_failed";
      await prisma.designRevision.update({
        where: { id: revision.id },
        data: { dataJson: data as any },
      });
      await prisma.designProject.update({
        where: { id: revision.designProjectId },
        data: { status: "APPROVED_FOR_EXPORT" },
      });
    }
    processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}
