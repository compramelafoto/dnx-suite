import sharp from "sharp";
import { DesignPreviewStatus, DesignProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateR2Key, normalizePreviewUrl, uploadToR2 } from "@/lib/r2-client";
import { parseRevisionDataJson } from "./editor-data";
import {
  markPreviewJobCompleted,
  markPreviewJobFailed,
  markPreviewJobProcessing,
  pickNextPreviewJob,
  PREVIEW_MAX_WIDTH,
} from "./preview-jobs";
import { mergeRevisionDataJsonPatch } from "./revision-data";
import { fetchBufferFromUrl, renderSchoolDesignJpeg } from "./render-composite";
import { markPreviewRendered } from "./review-actions";

/**
 * Procesa un job de preview (llamar desde cron). Retorna true si procesó uno.
 */
export async function processOneDesignPreviewJob(): Promise<boolean> {
  const job = await pickNextPreviewJob();
  if (!job) return false;

  await markPreviewJobProcessing(job.id);

  const rev = job.designRevision;
  const project = rev.designProject;
  const template = project.template;

  try {
    const raw = rev.dataJson;
    if (!parseRevisionDataJson(raw)) {
      throw new Error("dataJson inválido o versión de schema no soportada");
    }

    const templateUrl = template.imageUrl;
    const templateBuf = await fetchBufferFromUrl(templateUrl);

    const loadPhotoBuffer = async (photoId: number) => {
      const photo = await prisma.photo.findUnique({ where: { id: photoId } });
      if (!photo) {
        throw new Error(`Foto ${photoId} no encontrada`);
      }
      const url = normalizePreviewUrl(photo.previewUrl, photo.originalKey);
      if (!url) {
        throw new Error(`Sin URL para foto ${photoId}`);
      }
      return fetchBufferFromUrl(url);
    };

    const jpeg = await renderSchoolDesignJpeg({
      templateImageBuffer: templateBuf,
      slots: template.slots.map((s) => ({
        id: s.id,
        pageIndex: s.pageIndex,
        bbox: s.bbox,
      })),
      dataJson: raw,
      loadPhotoBuffer,
      outputMaxWidth: PREVIEW_MAX_WIDTH,
      jpegQuality: 82,
    });

    const meta = await sharp(jpeg).metadata();
    const key = generateR2Key(`school-preview-${project.id}-v${job.targetVersion}.jpg`, "school-design-previews");
    const { url } = await uploadToR2(jpeg, key, "image/jpeg");

    await prisma.designRevision.update({
      where: { id: rev.id },
      data: {
        dataJson: mergeRevisionDataJsonPatch(raw, {
          previewUrl: url,
          previewStatus: "READY",
          previewVersion: job.targetVersion,
          previewGeneratedAt: new Date().toISOString(),
          previewWidth: meta.width ?? null,
          previewHeight: meta.height ?? null,
          previewError: null,
          previewDirty: false,
        }),
      },
    });

    await markPreviewRendered({
      designProjectId: project.id,
      designRevisionId: rev.id,
      previewUrl: url,
      previewVersion: job.targetVersion,
    });
    await markPreviewJobCompleted(job.id);
    console.log("[school_design_preview] done", { jobId: job.id, designProjectId: project.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[school_design_preview] job failed", job.id, msg);
    await markPreviewJobFailed(job.id, msg);
    await prisma.designProject.update({
      where: { id: project.id },
      data: {
        previewStatus: DesignPreviewStatus.FAILED,
        previewError: msg,
        status: DesignProjectStatus.DRAFT,
      },
    });
  }

  return true;
}
