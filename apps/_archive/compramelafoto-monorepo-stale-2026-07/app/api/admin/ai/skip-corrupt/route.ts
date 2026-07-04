import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ai/skip-corrupt
 * 
 * Marca fotos corruptas como "SKIPPED" para excluirlas del procesamiento futuro
 * Solo accesible por ADMIN
 */
export async function POST(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    // Buscar jobs con errores de imágenes corruptas
    const corruptJobs = await prisma.photoAnalysisJob.findMany({
      where: {
        status: "ERROR",
        OR: [
          { lastError: { contains: "corrupta" } },
          { lastError: { contains: "corrupt" } },
          { lastError: { contains: "formato no soportado" } },
          { lastError: { contains: "DECODER" } },
          { lastError: { contains: "decoder" } },
          { lastError: { contains: "1E08010C" } },
        ],
      },
      select: {
        id: true,
        photoId: true,
        lastError: true,
      },
    });

    if (corruptJobs.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No se encontraron fotos corruptas para marcar como skip",
        skipped: 0,
      });
    }

    const photoIds = corruptJobs.map((job) => job.photoId);
    const jobIds = corruptJobs.map((job) => job.id);

    // Eliminar los jobs (no los necesitamos más)
    await prisma.photoAnalysisJob.deleteMany({
      where: { id: { in: jobIds } },
    });

    // Marcar las fotos como "ERROR" pero con un mensaje especial que indique que fueron skiped
    await prisma.photo.updateMany({
      where: { id: { in: photoIds } },
      data: { 
        analysisStatus: "ERROR", 
        analysisError: "Imagen corrupta - excluida del procesamiento automático",
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Se marcaron ${corruptJobs.length} fotos corruptas como excluidas del procesamiento`,
      skipped: corruptJobs.length,
      note: "Estas fotos no se procesarán automáticamente. Las nuevas fotos que subas se procesarán normalmente.",
    });
  } catch (error: any) {
    console.error("Error en skip-corrupt:", error);
    return NextResponse.json(
      { error: "Error al marcar fotos corruptas como skip", detail: error?.message },
      { status: 500 }
    );
  }
}
