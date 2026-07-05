import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireOrganizerOwnedProfile } from "@/lib/organizer-landing-profile";
import {
  mapOrganizerSponsor,
  parseSortOrder,
  validateSponsorName,
  validateSponsorUrl,
} from "@/lib/organizer-landing-sponsors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/landing/sponsors
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const profile = await requireOrganizerOwnedProfile(user.id);
    const rows = await prisma.organizerLandingSponsor.findMany({
      where: { profileId: profile.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({ items: rows.map(mapOrganizerSponsor) });
  } catch (err: unknown) {
    console.error("GET /api/organizer/landing/sponsors ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo sponsors", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizer/landing/sponsors
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const nameResult = validateSponsorName(body?.name);
    if (!nameResult.ok) {
      return NextResponse.json({ error: nameResult.error }, { status: 400 });
    }

    const urlResult = validateSponsorUrl(body?.url);
    if (!urlResult.ok) {
      return NextResponse.json({ error: urlResult.error }, { status: 400 });
    }

    const profile = await requireOrganizerOwnedProfile(user.id);

    const maxOrder = await prisma.organizerLandingSponsor.aggregate({
      where: { profileId: profile.id },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const row = await prisma.organizerLandingSponsor.create({
      data: {
        profileId: profile.id,
        name: nameResult.value,
        url: urlResult.value,
        sortOrder: parseSortOrder(body?.sortOrder, nextOrder),
        isActive: body?.isActive !== false,
      },
    });

    return NextResponse.json({ sponsor: mapOrganizerSponsor(row) }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/organizer/landing/sponsors ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando sponsor", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
