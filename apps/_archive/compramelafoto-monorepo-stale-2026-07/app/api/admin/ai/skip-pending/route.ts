import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ai/skip-pending
 * 
 * Marca TODAS las fotos pendientes como "SKIPPED" para excluirlas del procesamiento futuro
 * Solo accesible por ADMIN
 */
export async function POST(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    // Buscar todos los jobs pendientes
    const pendingJobs = await prisma.photoAnalysisJob.findMany({
      where: {
        status: "PENDING",
      },
      select: {
        id: true,
        photoId: true,
      },
    });

    if (pendingJobs.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No se encontraron fotos pendientes para excluir",
        skipped: 0,
      });
    }

    const photoIds = pendingJobs.map((job) => job.photoId);
    const jobIds = pendingJobs.map((job) => job.id);

    // Eliminar los jobs (no los necesitamos más)
    await prisma.photoAnalysisJob.deleteMany({
      where: { id: { in: jobIds } },
    });

    // Marcar las fotos como "ERROR" pero con un mensaje especial que indique que fueron excluidas
    await prisma.photo.updateMany({
      where: { id: { in: photoIds } },
      data: { 
        analysisStatus: "ERROR", 
        analysisError: "Pendiente excluida del procesamiento automático",
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Se marcaron ${pendingJobs.length} fotos pendientes como excluidas del procesamiento`,
      skipped: pendingJobs.length,
      note: "Estas fotos no se procesarán automáticamente. Las nuevas fotos que subas se procesarán normalmente.",
    });
  } catch (error: any) {
    console.error("Error en skip-pending:", error);
    return NextResponse.json(
      { error: "Error al marcar fotos pendientes como skip", detail: error?.message },
      { status: 500 }
    );
  }
}
