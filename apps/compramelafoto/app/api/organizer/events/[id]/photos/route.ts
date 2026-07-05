import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";
import { getOrganizerDownloadAllowance } from "@/lib/events/organizer-downloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/events/[id]/photos
 * Lista fotos públicas del evento para descarga del organizador.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, creatorId: true },
    });
    if (!event || event.creatorId !== user.id) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const photos = await prisma.photo.findMany({
      where: {
        album: {
          eventId,
          isHidden: false,
          isPublic: true,
          deletedAt: null,
        },
        isRemoved: false,
      },
      select: {
        id: true,
        previewUrl: true,
        albumId: true,
        album: { select: { publicSlug: true } },
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    const allowance = await getOrganizerDownloadAllowance({
      eventId,
      organizerId: user.id,
    });

    return NextResponse.json({
      photos: photos.map((p) => ({
        id: p.id,
        previewUrl: p.previewUrl ? getR2PublicUrl(p.previewUrl) : null,
        albumId: p.albumId,
        albumSlug: p.album?.publicSlug ?? null,
        photographerName: p.uploadedBy?.name ?? null,
      })),
      allowance,
    });
  } catch (err: unknown) {
    console.error("GET /api/organizer/events/[id]/photos ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo fotos del evento", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
