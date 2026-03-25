import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ai/unlock-stuck
 * 
 * Desbloquea jobs que están en PROCESSING por más de 15 minutos
 * (probablemente quedaron trabados por timeout o error no capturado)
 * Solo accesible por ADMIN
 */
export async function POST(req: Request) {
  try {
    // Verificar autenticación y rol ADMIN
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    const url = new URL(req.url);
    const minutesThreshold = Math.min(60, Math.max(5, Number(url.searchParams.get("minutes") || 15)));

    // Buscar jobs en PROCESSING que están bloqueados hace más de X minutos
    const thresholdTime = new Date(Date.now() - minutesThreshold * 60 * 1000);
    
    const stuckJobs = await prisma.photoAnalysisJob.findMany({
      where: {
        status: "PROCESSING",
        lockedAt: {
          lt: thresholdTime, // lockedAt es anterior al threshold
        },
      },
      select: {
        id: true,
        photoId: true,
        attempts: true,
        lockedAt: true,
        lastError: true,
      },
    });

    if (stuckJobs.length === 0) {
      return NextResponse.json({
        ok: true,
        message: `No se encontraron jobs trabados en PROCESSING por más de ${minutesThreshold} minutos`,
        unlocked: 0,
      });
    }

    const jobIds = stuckJobs.map((job) => job.id);
    const photoIds = stuckJobs.map((job) => job.photoId);

    // Resetear jobs a PENDING para que se vuelvan a procesar
    await prisma.photoAnalysisJob.updateMany({
      where: { id: { in: jobIds } },
      data: {
        status: "PENDING",
        lockedAt: null,
        // Incrementar attempts solo si no es el primer intento
        attempts: {
          increment: 0, // No incrementar, solo resetear
        },
      },
    });

    // Resetear estado de las fotos también
    await prisma.photo.updateMany({
      where: { id: { in: photoIds } },
      data: {
        analysisStatus: "PENDING",
        analysisError: null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Se desbloquearon ${stuckJobs.length} jobs trabados en PROCESSING`,
      unlocked: stuckJobs.length,
      thresholdMinutes: minutesThreshold,
      jobs: stuckJobs.map((job) => ({
        jobId: job.id,
        photoId: job.photoId,
        attempts: job.attempts,
        lockedAt: job.lockedAt,
        stuckForMinutes: job.lockedAt 
          ? Math.round((Date.now() - job.lockedAt.getTime()) / 60000)
          : null,
      })),
    });
  } catch (error: any) {
    console.error("Error en unlock-stuck:", error);
    return NextResponse.json(
      { error: "Error al desbloquear jobs trabados", detail: error?.message },
      { status: 500 }
    );
  }
}
