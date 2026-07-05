import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCronAuth } from "@/lib/cron-auth";
import { renderDesignPreview } from "@/lib/school-render/preview-renderer";
import { generateR2Key, uploadToR2 } from "@/lib/r2-client";
import { normalizeEditorDataJson } from "@/lib/school-render/design-editor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 3;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const jobs = await prisma.designPreviewJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, designRevisionId: true },
  });

  let processed = 0;
  for (const job of jobs) {
    const locked = await prisma.designPreviewJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } },
    });
    if (locked.count !== 1) {
      console.info("[school_design_preview_job] job_deduplicated", { jobId: job.id });
      continue;
    }

    console.info("[school_design_preview_job] job_started", { jobId: job.id });
    const revision = await prisma.designRevision.findUnique({
      where: { id: job.designRevisionId },
      select: { id: true, dataJson: true, designProjectId: true },
    });
    if (!revision) {
      await prisma.designPreviewJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: "revision_not_found" },
      });
      continue;
    }

    const ctx = await prisma.designProject.findUnique({
      where: { id: revision.designProjectId },
      select: {
        id: true,
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

    if (!ctx?.template?.imageUrl || !ctx.template.widthCm || !ctx.template.heightCm) {
      data.previewStatus = "FAILED";
      data.previewError = "template_missing";
      await prisma.designRevision.update({
        where: { id: revision.id },
        data: { dataJson: data as any },
      });
      await prisma.designPreviewJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: "template_missing" },
      });
      console.info("[school_design_preview_job] preview_status_failed", { jobId: job.id });
      continue;
    }

    try {
      const render = await renderDesignPreview({
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
        targetWidthPx: 1600,
      });
      if (!render.ok || !render.buffer) {
        data.previewStatus = "FAILED";
        data.previewError = render.error || "render_failed";
        await prisma.designRevision.update({
          where: { id: revision.id },
          data: { dataJson: data as any },
        });
        await prisma.designPreviewJob.update({
          where: { id: job.id },
          data: { status: "FAILED", lastError: data.previewError },
        });
        console.info("[school_design_preview_job] preview_status_failed", { jobId: job.id });
        continue;
      }

      const key = generateR2Key(`design-preview-${revision.id}.jpg`, "design-previews");
      const upload = await uploadToR2(render.buffer, key, "image/jpeg");
      const nextVersion = (data.previewVersion ?? 0) + 1;
      data.previewDirty = false;
      data.previewStatus = "READY";
      data.previewGeneratedAt = new Date().toISOString();
      data.previewVersion = nextVersion;
      data.previewUrl = upload.url;
      data.previewWidth = render.width ?? null;
      data.previewHeight = render.height ?? null;
      data.previewError = null;
      await prisma.designRevision.update({
        where: { id: revision.id },
        data: { dataJson: data as any },
      });
      await prisma.designPreviewJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED" },
      });
      console.info("[school_design_preview_job] job_succeeded", { jobId: job.id });
      console.info("[school_design_preview_job] preview_status_ready", { jobId: job.id });
    } catch (err) {
      await prisma.designPreviewJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: err instanceof Error ? err.message : "render_failed" },
      });
      console.error("[school_design_preview_job] job_failed", { jobId: job.id, err });
      data.previewStatus = "FAILED";
      data.previewError = "render_failed";
      await prisma.designRevision.update({
        where: { id: revision.id },
        data: { dataJson: data as any },
      });
    }
    processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}
