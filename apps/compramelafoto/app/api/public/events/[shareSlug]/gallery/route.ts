import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { buildEventGalleryPhotoGridItem } from "@/lib/events/event-gallery-public-photos";
import { canAccessEventByShareSlug } from "@/lib/public/public-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/events/[shareSlug]/gallery
 * Galería pública unificada. Preview vía /api/photos/.../view (sin keys R2).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareSlug: string }> | { shareSlug: string } }
) {
  try {
    const { shareSlug } = await Promise.resolve(params);
    if (!shareSlug || typeof shareSlug !== "string") {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { shareSlug },
      select: { id: true, visibility: true, archivedAt: true },
    });
    if (!event || !canAccessEventByShareSlug(event)) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const photos = await prisma.photo.findMany({
      where: {
        album: {
          eventId: event.id,
          isHidden: false,
          isPublic: true,
          deletedAt: null,
        },
        isRemoved: false,
      },
      select: {
        id: true,
        albumId: true,
        album: { select: { publicSlug: true, isPublic: true, isHidden: true } },
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    return NextResponse.json({
      photos: photos
        .filter((p) =>
          p.album
            ? isAlbumPubliclyAccessible({
                isPublic: p.album.isPublic,
                isHidden: p.album.isHidden,
              })
            : false
        )
        .map((p) => {
          const grid = buildEventGalleryPhotoGridItem({
            id: p.id,
            albumId: p.albumId,
            photographerName: p.uploadedBy?.name ?? null,
            mode: "thumb",
          });
          return {
            id: p.id,
            previewUrl: grid.src,
            albumId: p.albumId,
            albumSlug: p.album?.publicSlug ?? null,
            photographerName: p.uploadedBy?.name ?? null,
          };
        }),
    });
  } catch (err: unknown) {
    console.error("GET /api/public/events/[shareSlug]/gallery ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo galería" },
      { status: 500 }
    );
  }
}
