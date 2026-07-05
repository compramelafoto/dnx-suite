import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireOrganizerOwnedProfile } from "@/lib/organizer-landing-profile";
import { mapFeaturedGalleryRow, organizerFeaturedGalleryInclude } from "@/lib/organizer-landing-featured";
import { prisma } from "@/lib/prisma";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const featuredInclude = organizerFeaturedGalleryInclude;

async function validateFeaturedTarget(
  organizerUserId: number,
  albumId: number | null,
  eventId: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hasAlbum = albumId != null && Number.isFinite(albumId);
  const hasEvent = eventId != null && Number.isFinite(eventId);
  if (!hasAlbum && !hasEvent) {
    return { ok: false, error: "Debés elegir un álbum o un evento." };
  }
  if (hasAlbum && hasEvent) {
    return { ok: false, error: "Elegí solo un álbum o un evento, no ambos." };
  }

  if (hasEvent) {
    const ev = await prisma.event.findFirst({
      where: { id: eventId!, creatorId: organizerUserId, archivedAt: null },
    });
    if (!ev) return { ok: false, error: "Evento no encontrado o no te pertenece." };
    return { ok: true };
  }

  const alb = await prisma.album.findFirst({
    where: { id: albumId!, deletedAt: null, event: { creatorId: organizerUserId } },
    select: { id: true, isPublic: true, isHidden: true },
  });
  if (!alb) return { ok: false, error: "Álbum no encontrado o no pertenece a tus eventos." };
  if (!isAlbumPubliclyAccessible(alb)) {
    return { ok: false, error: "El álbum debe ser público y visible para destacarlo." };
  }
  return { ok: true };
}

/**
 * GET /api/organizer/landing/featured
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const profile = await requireOrganizerOwnedProfile(user.id);
    const rows = await prisma.organizerFeaturedGallery.findMany({
      where: { profileId: profile.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: featuredInclude,
    });

    return NextResponse.json({ items: rows.map(mapFeaturedGalleryRow) });
  } catch (err: unknown) {
    console.error("GET /api/organizer/landing/featured ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo destacados", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizer/landing/featured
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const albumId =
      body?.albumId != null && body.albumId !== "" ? Number(body.albumId) : null;
    const eventId =
      body?.eventId != null && body.eventId !== "" ? Number(body.eventId) : null;

    const validation = await validateFeaturedTarget(user.id, albumId, eventId);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const profile = await requireOrganizerOwnedProfile(user.id);

    const duplicate = await prisma.organizerFeaturedGallery.findFirst({
      where: {
        profileId: profile.id,
        ...(albumId ? { albumId } : { eventId: eventId! }),
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Ya está en destacados." }, { status: 409 });
    }

    const maxOrder = await prisma.organizerFeaturedGallery.aggregate({
      where: { profileId: profile.id },
      _max: { sortOrder: true },
    });

    const row = await prisma.organizerFeaturedGallery.create({
      data: {
        profileId: profile.id,
        albumId: albumId || null,
        eventId: eventId || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        isActive: body?.isActive !== false,
      },
      include: featuredInclude,
    });

    return NextResponse.json({ item: mapFeaturedGalleryRow(row) }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/organizer/landing/featured ERROR >>>", err);
    return NextResponse.json(
      { error: "Error agregando destacado", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
