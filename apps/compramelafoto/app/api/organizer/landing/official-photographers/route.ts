import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireOrganizerOwnedProfile } from "@/lib/organizer-landing-profile";
import {
  listOrganizerOfficialPhotographers,
  mapOrganizerOfficialPhotographerRow,
  parseSortOrder,
  validatePhotographerForOfficialListing,
  loadOfficialPhotographerEventCounts,
} from "@/lib/organizer-landing-official-photographers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const photographerInclude = {
  photographer: {
    select: {
      id: true,
      name: true,
      companyName: true,
      city: true,
      province: true,
      logoUrl: true,
      publicPageHandler: true,
      isPublicPageEnabled: true,
      role: true,
      isBlocked: true,
    },
  },
} as const;

/**
 * GET /api/organizer/landing/official-photographers
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER, Role.SCHOOL_ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const profile = await requireOrganizerOwnedProfile(user.id);
    const items = await listOrganizerOfficialPhotographers(profile.id, user.id);
    return NextResponse.json({ items });
  } catch (err: unknown) {
    console.error("GET /api/organizer/landing/official-photographers ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo fotógrafos oficiales", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizer/landing/official-photographers
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER, Role.SCHOOL_ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const photographerUserId = Number(body?.photographerUserId);
    const validation = await validatePhotographerForOfficialListing(photographerUserId);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const profile = await requireOrganizerOwnedProfile(user.id);

    const duplicate = await prisma.organizerOfficialPhotographer.findFirst({
      where: { profileId: profile.id, photographerUserId },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Ese fotógrafo ya está en tu listado oficial." }, { status: 409 });
    }

    const maxOrder = await prisma.organizerOfficialPhotographer.aggregate({
      where: { profileId: profile.id },
      _max: { sortOrder: true },
    });

    const row = await prisma.organizerOfficialPhotographer.create({
      data: {
        profileId: profile.id,
        photographerUserId,
        sortOrder: parseSortOrder(body?.sortOrder, (maxOrder._max.sortOrder ?? -1) + 1),
        isActive: body?.isActive !== false,
      },
      include: photographerInclude,
    });

    const eventCounts = await loadOfficialPhotographerEventCounts(user.id);
    return NextResponse.json(
      {
        item: mapOrganizerOfficialPhotographerRow(
          row,
          eventCounts.get(row.photographerUserId) ?? 0
        ),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/organizer/landing/official-photographers ERROR >>>", err);
    return NextResponse.json(
      { error: "Error agregando fotógrafo oficial", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
