import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ai/skip-all-errors
 * 
 * Marca TODAS las fotos con errores como "SKIPPED" para excluirlas del procesamiento futuro
 * Solo accesible por ADMIN
 */
export async function POST(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    // Buscar todos los jobs con errores
    const errorJobs = await prisma.photoAnalysisJob.findMany({
      where: {
        status: "ERROR",
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
        message: "No se encontraron fotos con errores para excluir",
        skipped: 0,
      });
    }

    const photoIds = errorJobs.map((job) => job.photoId);
    const jobIds = errorJobs.map((job) => job.id);

    // Eliminar los jobs (no los necesitamos más)
    await prisma.photoAnalysisJob.deleteMany({
      where: { id: { in: jobIds } },
    });

    // Marcar las fotos como "ERROR" pero con un mensaje especial que indique que fueron excluidas
    await prisma.photo.updateMany({
      where: { id: { in: photoIds } },
      data: { 
        analysisStatus: "ERROR", 
        analysisError: "Error en análisis - excluida del procesamiento automático",
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Se marcaron ${errorJobs.length} fotos con errores como excluidas del procesamiento`,
      skipped: errorJobs.length,
      note: "Estas fotos no se procesarán automáticamente. Las nuevas fotos que subas se procesarán normalmente.",
    });
  } catch (error: any) {
    console.error("Error en skip-all-errors:", error);
    return NextResponse.json(
      { error: "Error al marcar fotos con errores como skip", detail: error?.message },
      { status: 500 }
    );
  }
}
