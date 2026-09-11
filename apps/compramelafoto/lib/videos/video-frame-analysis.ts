import type { PrismaClient } from "@/lib/prisma";
import { readFromR2 } from "@/lib/r2-client";
import { indexFaces } from "@/lib/faces/rekognition";
import { frameExternalImageId } from "@/lib/videos/video-frame-matching";

/**
 * Indexa en Rekognition las caras de los fotogramas que extrajo el worker.
 *
 * Vive en la app y no en el worker porque acá ya está montado todo Rekognition
 * (cliente, colección, normalización de bytes). El worker hace ffmpeg, que es
 * lo que sabe hacer, y deja los fotogramas en R2; esto los levanta de ahí.
 */

export type FrameAnalysisResult = {
  ok: true;
  revisados: number;
  analizados: number;
  carasIndexadas: number;
  errores: { videoFrameId: number; error: string }[];
};

export async function analyzePendingVideoFrames(
  prisma: PrismaClient,
  opts: { max?: number } = {}
): Promise<FrameAnalysisResult> {
  const max = opts.max ?? 40;

  const pendientes = await prisma.videoFrame.findMany({
    where: {
      analysisStatus: "PENDING",
      // Un fotograma de un video borrado o vencido no se analiza: el cliente no
      // va a poder verlo igual.
      video: { isRemoved: false, expiresAt: { gt: new Date() } },
    },
    select: { id: true, key: true, videoId: true },
    orderBy: { id: "asc" },
    take: max,
  });

  const errores: { videoFrameId: number; error: string }[] = [];
  let analizados = 0;
  let carasIndexadas = 0;

  for (const frame of pendientes) {
    try {
      await prisma.videoFrame.update({
        where: { id: frame.id },
        data: { analysisStatus: "PROCESSING" },
      });

      const bytes = await readFromR2(frame.key);
      const caras = await indexFaces({
        imageBytes: bytes,
        externalImageId: frameExternalImageId(frame.id),
      });

      if (caras.length > 0) {
        await prisma.videoFrameFace.createMany({
          data: caras.map((c) => ({
            videoFrameId: frame.id,
            rekognitionFaceId: c.rekognitionFaceId,
            confidence: c.confidence ?? null,
            bbox: c.bbox,
          })),
          skipDuplicates: true,
        });
      }

      await prisma.videoFrame.update({
        where: { id: frame.id },
        data: {
          analysisStatus: "DONE",
          analysisError: null,
          analyzedAt: new Date(),
          facesCount: caras.length,
        },
      });

      analizados += 1;
      carasIndexadas += caras.length;
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("[video-frame-analysis] falló", { videoFrameId: frame.id, error });
      errores.push({ videoFrameId: frame.id, error });
      await prisma.videoFrame
        .update({
          where: { id: frame.id },
          data: { analysisStatus: "ERROR", analysisError: error.slice(0, 500) },
        })
        .catch(() => undefined);
    }
  }

  console.info("[video-frame-analysis] corrida", {
    revisados: pendientes.length,
    analizados,
    carasIndexadas,
    errores: errores.length,
  });

  return { ok: true, revisados: pendientes.length, analizados, carasIndexadas, errores };
}
