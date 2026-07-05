import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerAccess } from "@/lib/school-organizer-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

function parseSchoolId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const albums = await prisma.album.findMany({
      where: {
        schoolId,
        deletedAt: null,
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        location: true,
        publicSlug: true,
        eventDate: true,
        createdAt: true,
        isTest: true,
        isHidden: true,
        preCompraCloseAt: true,
        organizerCommissionEnabled: true,
        organizerCommissionPercentage: true,
        organizerCommissionAppliesTo: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const albumIds = albums.map((album) => album.id);
    const [studentCounts, photoCounts, orderCounts] = await Promise.all([
      albumIds.length
        ? prisma.albumStudentRosterEntry.groupBy({
            by: ["albumId"],
            where: { albumId: { in: albumIds }, isActive: true },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      albumIds.length
        ? prisma.photo.groupBy({
            by: ["albumId"],
            where: { albumId: { in: albumIds }, isRemoved: false },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      albumIds.length
        ? prisma.preCompraOrder.groupBy({
            by: ["albumId"],
            where: { albumId: { in: albumIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const studentCountByAlbumId = new Map(studentCounts.map((row) => [row.albumId, row._count._all]));
    const photoCountByAlbumId = new Map(photoCounts.map((row) => [row.albumId, row._count._all]));
    const orderCountByAlbumId = new Map(orderCounts.map((row) => [row.albumId, row._count._all]));

    return NextResponse.json(
      albums.map((album) => {
        const basePublicUrl = album.publicSlug ? `/album/${album.publicSlug}` : null;
        return {
          id: album.id,
          title: album.title,
          description: album.location,
          publicSlug: album.publicSlug,
          eventDate: album.eventDate,
          isTest: album.isTest,
          status: album.isTest ? "TEST" : album.isHidden ? "OCULTO" : "ACTIVO",
          owner: album.user,
          studentsCount: studentCountByAlbumId.get(album.id) ?? 0,
          photosCount: photoCountByAlbumId.get(album.id) ?? 0,
          ordersCount: orderCountByAlbumId.get(album.id) ?? 0,
          commissionConfig: {
            enabled: album.organizerCommissionEnabled,
            percentage: album.organizerCommissionPercentage,
            appliesTo: album.organizerCommissionAppliesTo,
            disclaimer:
              "Se calcula sobre valor neto del servicio, sin incluir fee de plataforma.",
          },
          links: {
            album: basePublicUrl,
            preventa: basePublicUrl ? `${basePublicUrl}/preventa` : null,
            precompra: basePublicUrl ? `${basePublicUrl}/precompra` : null,
          },
          preCompraCloseAt: album.preCompraCloseAt,
          createdAt: album.createdAt,
        };
      })
    );
  } catch (err) {
    console.error("GET /api/school-organizer/schools/[schoolId]/albums:", err);
    return NextResponse.json({ error: "Error obteniendo álbumes de la escuela" }, { status: 500 });
  }
}
