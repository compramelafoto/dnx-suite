import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
  if (!secret) return isVercelCron;
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim() === secret;
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token === secret || isVercelCron;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const resetErrors = url.searchParams.get("resetErrors") === "1";
  const reprocessAll = url.searchParams.get("reprocessAll") === "1";

  let created = 0;
  let reset = 0;
  let reprocessed = 0;

  // Modo: Reprocesar TODAS las fotos (incluso las ya procesadas)
  if (reprocessAll) {
    // Obtener todas las fotos que no están eliminadas
    const allPhotos = await prisma.photo.findMany({
      where: { isRemoved: false },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    if (allPhotos.length > 0) {
      const photoIds = allPhotos.map((p) => p.id);

      // Eliminar jobs existentes y tokens OCR/face detection para estas fotos
      await prisma.$transaction([
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

      reprocessed = allPhotos.length;
    }
  } else {
    // Modo normal: Solo crear jobs para fotos sin análisis
    const missingPhotos = await prisma.photo.findMany({
      where: { analysisJob: null, isRemoved: false },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    if (missingPhotos.length > 0) {
      await prisma.photoAnalysisJob.createMany({
        data: missingPhotos.map((p) => ({
          photoId: p.id,
          status: "PENDING",
        })),
        skipDuplicates: true,
      });
      await prisma.photo.updateMany({
        where: { id: { in: missingPhotos.map((p) => p.id) } },
        data: { analysisStatus: "PENDING", analysisError: null },
      });
      created = missingPhotos.length;
    }

    // Resetear jobs con errores
    if (resetErrors) {
      const errorJobs = await prisma.photoAnalysisJob.findMany({
        where: { status: "ERROR" },
        select: { id: true, photoId: true },
        orderBy: { updatedAt: "asc" },
        take: limit,
      });
      if (errorJobs.length > 0) {
        await prisma.photoAnalysisJob.updateMany({
          where: { id: { in: errorJobs.map((j) => j.id) } },
          data: { status: "PENDING", attempts: 0, runAfter: null, lockedAt: null },
        });
        await prisma.photo.updateMany({
          where: { id: { in: errorJobs.map((j) => j.photoId) } },
          data: { analysisStatus: "PENDING", analysisError: null },
        });
        reset = errorJobs.length;
      }
    }
  }

  return NextResponse.json({ ok: true, created, reset, reprocessed });
}
