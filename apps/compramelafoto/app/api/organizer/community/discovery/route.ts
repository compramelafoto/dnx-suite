import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getOrganizerPrivateCommunityDiscovery } from "@/lib/organizer-community-discovery";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/community/discovery
 * Fotógrafos para descubrimiento privado (cercanos, sugeridos, plataforma).
 * No exponer en la landing pública del organizador.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
    }

    const [profile, organizerUser] = await Promise.all([
      prisma.organizerPublicProfile.findFirst({
        where: { userId: user.id },
        select: { city: true, zone: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { city: true, province: true },
      }),
    ]);

    const discovery = await getOrganizerPrivateCommunityDiscovery(
      user.id,
      profile?.city ?? organizerUser?.city ?? null,
      profile?.zone ?? organizerUser?.province ?? null
    );

    return NextResponse.json(discovery);
  } catch (err: unknown) {
    console.error("GET /api/organizer/community/discovery ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo comunidad", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
