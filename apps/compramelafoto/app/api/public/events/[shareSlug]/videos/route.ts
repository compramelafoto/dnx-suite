import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { listPublicReadyVideosForEvent } from "@/lib/videos/public-event-videos";
import { resolveEventPublicVideoAccess } from "@/lib/videos/public-event-video-access";
import { canAccessEventByShareSlug } from "@/lib/public/public-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/events/[shareSlug]/videos
 * Videos READY de álbumes del evento colaborativo.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareSlug: string }> }
) {
  try {
    if (!isVideoMvpEnabled()) {
      return NextResponse.json({ videos: [] });
    }

    const { shareSlug } = await Promise.resolve(params);
    if (!shareSlug?.trim()) {
      return NextResponse.json({ error: "Slug de evento requerido" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { shareSlug: shareSlug.trim() },
      select: {
        id: true,
        creatorId: true,
        visibility: true,
        archivedAt: true,
      },
    });
    if (!event || !canAccessEventByShareSlug(event)) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const access = await resolveEventPublicVideoAccess(req, event);
    const { videos, devDiagnostics } = await listPublicReadyVideosForEvent(
      prisma,
      event.id,
      { applyExpiresFilter: access.applyExpiresFilter }
    );

    return NextResponse.json({
      videos,
      ...(devDiagnostics ? { _devDiagnostics: devDiagnostics } : {}),
    });
  } catch (err: unknown) {
    console.error("[public/events/videos] GET error", err);
    return NextResponse.json(
      { error: "Error listando videos del evento" },
      { status: 500 }
    );
  }
}
