/**
 * Adaptador Prisma del puerto de reconocimiento facial.
 *
 * La "búsqueda por rostro" del comprador queda registrada en `AlbumInterest`,
 * y cada coincidencia encontrada en `FaceMatchEvent`.
 */

import type { PrismaClient } from "@prisma/client";
import type { DateRange, FaceRecognitionPort, FaceRecognitionStats } from "@repo/ops-daily-report";

export function createPrismaFaceRecognitionPort(client: PrismaClient): FaceRecognitionPort {
  return {
    async stats(range: DateRange): Promise<FaceRecognitionStats> {
      const createdInRange = { createdAt: { gte: range.start, lt: range.end } };
      const updatedInRange = { updatedAt: { gte: range.start, lt: range.end } };

      const [
        photosAnalyzedDone,
        photosAnalyzedPending,
        photosAnalyzedError,
        facesDetected,
        matchEvents,
        interestsWithSearch,
        interestsWithAnyMatch,
        oldestPending,
      ] = await Promise.all([
        client.photoAnalysisJob.count({ where: { status: "DONE", ...updatedInRange } }),
        client.photoAnalysisJob.count({ where: { status: "PENDING" } }),
        client.photoAnalysisJob.count({ where: { status: "ERROR", ...updatedInRange } }),
        client.faceDetection.count({ where: createdInRange }),
        client.faceMatchEvent.count({ where: createdInRange }),
        // Solo cuentan como búsqueda por rostro los intereses que llegaron a
        // indexar una selfie: `faceId` es el identificador que devuelve
        // Rekognition. Sin él no hubo búsqueda biométrica.
        client.albumInterest.count({
          where: { ...createdInRange, faceId: { not: null } },
        }),
        client.albumInterest.count({
          where: { ...createdInRange, faceId: { not: null }, faceMatchEvents: { some: {} } },
        }),
        client.photoAnalysisJob.findFirst({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

      return {
        photosAnalyzedDone,
        photosAnalyzedPending,
        photosAnalyzedError,
        facesDetected,
        matchEvents,
        interestsWithSearch,
        interestsWithAnyMatch,
        oldestPendingAt: oldestPending?.createdAt ?? null,
      };
    },
  };
}
