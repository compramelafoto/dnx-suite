import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.SCHOOL_ORGANIZER]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json({ error: error || "No autenticado" }, { status });
    }

    const memberships = await prisma.schoolOrganizer.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
        schoolId: true,
        createdAt: true,
        school: {
          select: {
            id: true,
            name: true,
            city: true,
            province: true,
            logoUrl: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    const schoolIds = memberships.map((item) => item.schoolId);
    const albumCounts = schoolIds.length
      ? await prisma.album.groupBy({
          by: ["schoolId"],
          where: {
            schoolId: { in: schoolIds },
            deletedAt: null,
          },
          _count: { _all: true },
        })
      : [];
    const albumCountBySchoolId = new Map<number, number>();
    for (const row of albumCounts) {
      if (row.schoolId != null) {
        albumCountBySchoolId.set(row.schoolId, row._count._all);
      }
    }

    return NextResponse.json(
      memberships.map((item) => ({
        membershipId: item.id,
        id: item.school.id,
        name: item.school.name,
        city: item.school.city,
        province: item.school.province,
        logoUrl: item.school.logoUrl,
        albumsCount: albumCountBySchoolId.get(item.school.id) ?? 0,
      }))
    );
  } catch (err) {
    console.error("GET /api/school-organizer/schools:", err);
    return NextResponse.json({ error: "Error obteniendo escuelas asignadas" }, { status: 500 });
  }
}
