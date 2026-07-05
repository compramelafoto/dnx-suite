import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos máximo

/**
 * POST /api/admin/ai/reprocess-all
 * 
 * Endpoint para reprocesar TODAS las fotos existentes (OCR y reconocimiento facial)
 * Solo accesible por ADMIN
 * 
 * Este endpoint:
 * 1. Crea jobs de análisis para todas las fotos (incluso las ya procesadas)
 * 2. Elimina los análisis anteriores (OCR tokens y detecciones faciales)
 * 3. Retorna estadísticas del proceso
 */
export async function POST(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 200)));

    // Obtener todas las fotos que no están eliminadas
    const allPhotos = await prisma.photo.findMany({
      where: { isRemoved: false },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    if (allPhotos.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay fotos para reprocesar",
        reprocessed: 0,
        totalPhotos: 0,
      });
    }

    const photoIds = allPhotos.map((p) => p.id);

    // Eliminar jobs existentes y tokens OCR/face detection para estas fotos
    const [deletedJobs, deletedOcrTokens, deletedFaces] = await Promise.all([
      prisma.photoAnalysisJob.deleteMany({
        where: { photoId: { in: photoIds } },
      }),
      prisma.ocrToken.deleteMany({
        where: { photoId: { in: photoIds } },
      }),
      prisma.faceDetection.deleteMany({
        where: { photoId: { in: photoIds } },
      }),
    ]);

    // Crear nuevos jobs para todas las fotos
    await prisma.photoAnalysisJob.createMany({
      data: photoIds.map((photoId) => ({
        photoId,
        status: "PENDING",
      })),
    });

    // Resetear estado de análisis en las fotos
    await prisma.photo.updateMany({
      where: { id: { in: photoIds } },
      data: { analysisStatus: "PENDING", analysisError: null, analyzedAt: null },
    });

    // Obtener estadísticas totales
    const totalPhotos = await prisma.photo.count({
      where: { isRemoved: false },
    });

    const pendingJobs = await prisma.photoAnalysisJob.count({
      where: { status: "PENDING" },
    });

    return NextResponse.json({
      ok: true,
      message: `Se prepararon ${allPhotos.length} fotos para reprocesamiento`,
      reprocessed: allPhotos.length,
      deletedJobs: deletedJobs.count,
      deletedOcrTokens: deletedOcrTokens.count,
      deletedFaces: deletedFaces.count,
      totalPhotos,
      pendingJobs,
      nextStep: "Ejecuta el procesamiento llamando a /api/internal/analysis/run",
    });
  } catch (error: any) {
    console.error("Error en reprocess-all:", error);
    return NextResponse.json(
      { error: "Error al preparar fotos para reprocesamiento", detail: error?.message },
      { status: 500 }
    );
  }
}
