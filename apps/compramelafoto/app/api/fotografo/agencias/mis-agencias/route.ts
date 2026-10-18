import { NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { bpsToPercentLabel, effectiveCommissionBps, memberNeedsTerms, resolveAgencyTerms } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lo que el fotógrafo del equipo ve de cada agencia. Nunca incluye datos de clientes. */
export async function GET() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { mpAccessToken: true } });
  const memberships = await prisma.agencyMember.findMany({
    where: { userId: user.id, status: { in: ["ACTIVE", "REQUESTED"] } },
    orderBy: { createdAt: "desc" },
    select: {
      agencyId: true, status: true, commissionBps: true, termsVersionAccepted: true,
      agency: {
        select: {
          name: true, logoUrl: true, defaultCommissionBps: true, termsText: true, termsVersion: true,
          albums: { select: { albumId: true, album: { select: { title: true, publicSlug: true } } } },
        },
      },
    },
  });

  const albumIds = memberships.flatMap((m) => m.agency.albums.map((al) => al.albumId));
  const counts = albumIds.length
    ? await prisma.photo.groupBy({
        by: ["albumId"],
        where: { albumId: { in: albumIds }, userId: user.id, isRemoved: false },
        _count: { _all: true },
      })
    : [];
  const countByAlbum = new Map(counts.map((c) => [c.albumId, c._count._all]));

  return NextResponse.json({
    mpConnected: Boolean(me?.mpAccessToken),
    agencies: memberships.map((m) => ({
      agencyId: m.agencyId,
      name: m.agency.name,
      logoUrl: m.agency.logoUrl,
      status: m.status,
      commissionLabel: bpsToPercentLabel(effectiveCommissionBps(m, m.agency)),
      needsTerms: memberNeedsTerms(m, m.agency),
      terms: resolveAgencyTerms(m.agency),
      albums: m.agency.albums.map((al) => ({ title: al.album.title, publicSlug: al.album.publicSlug })),
      myPhotosCount: m.agency.albums.reduce((sum, al) => sum + (countByAlbum.get(al.albumId) ?? 0), 0),
    })),
  });
}
