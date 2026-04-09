import { DesignPreviewStatus, DesignProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateR2Key, normalizePreviewUrl, uploadToR2 } from "@/lib/r2-client";
import { parseRevisionDataJson } from "./editor-data";
import {
  EXPORT_MAX_WIDTH,
  markExportJobCompleted,
  markExportJobFailed,
  markExportJobProcessing,
  pickNextExportJob,
} from "./export-jobs";
import { fetchBufferFromUrl, renderSchoolDesignJpeg } from "./render-composite";

export async function processOneDesignExportJob(): Promise<boolean> {
  const job = await pickNextExportJob();
  if (!job) return false;

  await markExportJobProcessing(job.id);

  const rev = job.designRevision;
  const project = rev.designProject;
  const template = project.template;

  try {
    const dataJson = parseRevisionDataJson(rev.dataJson);
    if (!dataJson) {
      throw new Error("dataJson inválido");
    }

    const templateBuf = await fetchBufferFromUrl(template.imageUrl);

    const loadPhotoBuffer = async (photoId: number) => {
      const photo = await prisma.photo.findUnique({ where: { id: photoId } });
      if (!photo) throw new Error(`Foto ${photoId} no encontrada`);
      const url = normalizePreviewUrl(photo.previewUrl, photo.originalKey);
      if (!url) throw new Error(`Sin URL para foto ${photoId}`);
      return fetchBufferFromUrl(url);
    };

    const jpeg = await renderSchoolDesignJpeg({
      templateImageBuffer: templateBuf,
      slots: template.slots.map((s) => ({
        id: s.id,
        pageIndex: s.pageIndex,
        bbox: s.bbox,
      })),
      dataJson,
      loadPhotoBuffer,
      outputMaxWidth: EXPORT_MAX_WIDTH,
      jpegQuality: 94,
    });

    const key = generateR2Key(`school-export-${project.id}-v${job.targetVersion}.jpg`, "school-design-exports");
    const { url } = await uploadToR2(jpeg, key, "image/jpeg");

    await markExportJobCompleted(job.id, project.id, url);
    console.log("[school_design_export] export done", { jobId: job.id, designProjectId: project.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[school_design_export] job failed", job.id, msg);
    await markExportJobFailed(job.id, msg, project.id);
  }

  return true;
}
