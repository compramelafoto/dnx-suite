import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireOrganizerOwnedProfile } from "@/lib/organizer-landing-profile";
import { searchOrganizerFeaturedCandidates } from "@/lib/organizer-public-landing-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/landing/featured/search?q=
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const profile = await requireOrganizerOwnedProfile(user.id);
    const q = req.nextUrl.searchParams.get("q") ?? "";

    const result = await searchOrganizerFeaturedCandidates(user.id, profile.id, q);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("GET featured/search ERROR >>>", err);
    return NextResponse.json(
      { error: "Error en búsqueda", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
