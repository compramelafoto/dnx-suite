import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ai/reset-decoder-errors
 * 
 * Resetea específicamente los jobs con errores de decodificación de imágenes
 * para que se vuelvan a procesar con el nuevo código que normaliza imágenes
 * Solo accesible por ADMIN
 */
export async function POST(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    // Buscar jobs con errores de decodificación
    const errorJobs = await prisma.photoAnalysisJob.findMany({
      where: {
        status: "ERROR",
        OR: [
          { lastError: { contains: "DECODER" } },
          { lastError: { contains: "decoder" } },
          { lastError: { contains: "unsupported" } },
          { lastError: { contains: "1E08010C" } },
          { lastError: { contains: "corrupta" } },
          { lastError: { contains: "corrupt" } },
          { lastError: { contains: "Getting metadata from plugin" } },
        ],
      },
      select: {
        id: true,
        photoId: true,
        lastError: true,
      },
    });

    if (errorJobs.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No se encontraron jobs con errores de decodificación",
        reset: 0,
      });
    }

    const photoIds = errorJobs.map((job) => job.photoId);
    const jobIds = errorJobs.map((job) => job.id);

    // Eliminar tokens OCR y detecciones faciales existentes
    const [deletedOcrTokens, deletedFaces] = await Promise.all([
      prisma.ocrToken.deleteMany({
        where: { photoId: { in: photoIds } },
      }),
      prisma.faceDetection.deleteMany({
        where: { photoId: { in: photoIds } },
      }),
    ]);

    // Eliminar los jobs con error
    await prisma.photoAnalysisJob.deleteMany({
      where: { id: { in: jobIds } },
    });

    // Crear nuevos jobs PENDING para estas fotos
    await prisma.photoAnalysisJob.createMany({
      data: photoIds.map((photoId) => ({
        photoId,
        status: "PENDING",
        attempts: 0,
      })),
    });

    // Resetear estado de análisis en las fotos
    await prisma.photo.updateMany({
      where: { id: { in: photoIds } },
      data: { 
        analysisStatus: "PENDING", 
        analysisError: null, 
        analyzedAt: null 
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Se resetearon ${errorJobs.length} jobs con errores de decodificación`,
      reset: errorJobs.length,
      deletedOcrTokens: deletedOcrTokens.count,
      deletedFaces: deletedFaces.count,
      nextStep: "Ejecuta el procesamiento llamando a /api/admin/ai/process o desde el panel de IA",
    });
  } catch (error: any) {
    console.error("Error en reset-decoder-errors:", error);
    return NextResponse.json(
      { error: "Error al resetear jobs con errores de decodificación", detail: error?.message },
      { status: 500 }
    );
  }
}
