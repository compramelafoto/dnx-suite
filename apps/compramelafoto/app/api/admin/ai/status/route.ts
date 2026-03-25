import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai/status
 * 
 * Obtiene el estado del procesamiento de análisis de fotos
 * Solo accesible por ADMIN
 */
export async function GET(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    const [
      totalPhotos,
      pendingJobs,
      processingJobs,
      doneJobs,
      errorJobs,
      photosWithoutJob,
      photosWithOcrTokens,
      photosWithFaces,
      excludedPhotos,
      totalFaceMatches,
    ] = await Promise.all([
      prisma.photo.count({ where: { isRemoved: false } }),
      prisma.photoAnalysisJob.count({ where: { status: "PENDING" } }),
      prisma.photoAnalysisJob.count({ where: { status: "PROCESSING" } }),
      prisma.photoAnalysisJob.count({ where: { status: "DONE" } }),
      prisma.photoAnalysisJob.count({ where: { status: "ERROR" } }),
      prisma.photo.count({
        where: {
          isRemoved: false,
          analysisJob: null,
        },
      }),
      prisma.ocrToken.groupBy({
        by: ["photoId"],
        _count: { photoId: true },
      }).then((result) => result.length),
      prisma.faceDetection.groupBy({
        by: ["photoId"],
        _count: { photoId: true },
      }).then((result) => result.length),
      prisma.photo.count({
        where: {
          isRemoved: false,
          OR: [
            { analysisError: { contains: "excluida del procesamiento automático" } },
            { analysisError: { contains: "Error en análisis - excluida del procesamiento automático" } },
            { analysisError: { contains: "Pendiente excluida del procesamiento automático" } },
          ],
        },
      }),
      // Contar total de caras detectadas/indexadas (proxy para matches potenciales)
      prisma.faceDetection.count(),
    ]);

    return NextResponse.json({
      ok: true,
      stats: {
        totalPhotos,
        pendingJobs,
        processingJobs,
        doneJobs,
        errorJobs,
        photosWithoutJob,
        photosWithOcrTokens,
        photosWithFaces,
        excludedPhotos,
        totalFaceMatches,
        progressPercent: totalPhotos > 0
          ? Math.round((doneJobs / totalPhotos) * 100)
          : 0,
      },
    });
  } catch (error: any) {
    console.error("Error obteniendo estado:", error);
    return NextResponse.json(
      { error: "Error al obtener estado", detail: error?.message },
      { status: 500 }
    );
  }
}
