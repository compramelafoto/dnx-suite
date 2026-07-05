import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkPublicSlugAvailability } from "@/lib/public-slugs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/landing/slug-check?slug=
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const slug = req.nextUrl.searchParams.get("slug") ?? "";
    if (!slug.trim()) {
      return NextResponse.json({ available: false, reason: "Ingresá un slug para verificar." }, { status: 400 });
    }

    const existing = await prisma.organizerPublicProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    const result = await checkPublicSlugAvailability(slug, {
      excludeUserId: user.id,
      excludeProfileId: existing?.id,
    });

    return NextResponse.json({
      available: result.available,
      normalizedSlug: result.normalizedSlug,
      reason: result.available ? undefined : result.reason,
    });
  } catch (err: unknown) {
    console.error("GET /api/organizer/landing/slug-check ERROR >>>", err);
    return NextResponse.json(
      { error: "Error verificando slug", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
