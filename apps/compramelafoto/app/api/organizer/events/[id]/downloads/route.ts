import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getOrganizerDownloadAllowance } from "@/lib/events/organizer-downloads";
import { getSignedUrlForFile } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/organizer/events/[id]/downloads
 * Registra una descarga del organizador y devuelve URL firmada del archivo original.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const body = await req.json().catch(() => ({}));
    const photoId = Number(body?.photoId);
    if (!Number.isFinite(photoId)) {
      return NextResponse.json({ error: "photoId inválido" }, { status: 400 });
    }

    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        isRemoved: false,
        album: {
          eventId,
          isHidden: false,
          isPublic: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        originalKey: true,
        albumId: true,
        album: { select: { userId: true } },
        uploadedBy: { select: { id: true } },
      },
    });

    if (!photo || !photo.originalKey) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    const allowance = await getOrganizerDownloadAllowance({
      eventId,
      organizerId: user.id,
    });

    if (allowance.remainingDownloads <= 0) {
      return NextResponse.json(
        { error: "Cupo de descargas agotado" },
        { status: 403 }
      );
    }

    const signedUrl = await getSignedUrlForFile(photo.originalKey, 3600);

    await prisma.organizerEventDownload.create({
      data: {
        eventId,
        organizerId: user.id,
        photographerId: photo.uploadedBy?.id ?? photo.album?.userId ?? null,
        albumId: photo.albumId,
        photoId: photo.id,
      },
    });

    return NextResponse.json({
      url: signedUrl,
      allowance: {
        ...allowance,
        usedDownloads: allowance.usedDownloads + 1,
        remainingDownloads: Math.max(allowance.remainingDownloads - 1, 0),
      },
    });
  } catch (err: unknown) {
    console.error("POST /api/organizer/events/[id]/downloads ERROR >>>", err);
    return NextResponse.json(
      { error: "Error registrando descarga", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
