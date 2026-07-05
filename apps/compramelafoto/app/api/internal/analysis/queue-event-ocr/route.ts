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
  return url.searchParams.get("token") === secret || isVercelCron;
}

/**
 * POST /api/internal/analysis/queue-event-ocr?shareSlug=...
 *
 * Encola OCR para fotos del evento que ya tienen análisis facial (DONE) pero sin tokens OCR.
 * El cron `/api/internal/analysis/run?ocr=1` las procesará en lotes.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const shareSlug = (url.searchParams.get("shareSlug") || "").trim();
  const eventIdParam = url.searchParams.get("eventId");
  const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get("limit") || 500)));

  if (!shareSlug && !eventIdParam) {
    return NextResponse.json(
      { error: "Indicá shareSlug o eventId del evento" },
      { status: 400 }
    );
  }

  const event = await prisma.event.findFirst({
    where: shareSlug
      ? { shareSlug }
      : { id: Number(eventIdParam) },
    select: { id: true, title: true, shareSlug: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const photos = await prisma.photo.findMany({
    where: {
      isRemoved: false,
      analysisStatus: "DONE",
      ocrTokens: { none: {} },
      album: {
        eventId: event.id,
        isHidden: false,
        deletedAt: null,
      },
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take: limit,
  });

  if (photos.length === 0) {
    return NextResponse.json({
      ok: true,
      eventId: event.id,
      shareSlug: event.shareSlug,
      queued: 0,
      message: "No hay fotos pendientes de OCR para este evento.",
    });
  }

  const photoIds = photos.map((p) => p.id);

  await prisma.$transaction([
    prisma.photoAnalysisJob.deleteMany({
      where: { photoId: { in: photoIds } },
    }),
    prisma.photoAnalysisJob.createMany({
      data: photoIds.map((photoId) => ({ photoId, status: "PENDING" })),
    }),
    prisma.photo.updateMany({
      where: { id: { in: photoIds } },
      data: { analysisStatus: "PENDING", analysisError: null },
    }),
  ]);

  const pendingForEvent = await prisma.photoAnalysisJob.count({
    where: {
      status: "PENDING",
      photo: { album: { eventId: event.id } },
    },
  });

  return NextResponse.json({
    ok: true,
    eventId: event.id,
    eventTitle: event.title,
    shareSlug: event.shareSlug,
    queued: photoIds.length,
    pendingJobsForEvent: pendingForEvent,
    hint: "El cron de análisis con OCR procesará los jobs en lotes (puede tardar según volumen).",
  });
}
