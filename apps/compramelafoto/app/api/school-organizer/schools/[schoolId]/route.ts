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

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        city: true,
        province: true,
        logoUrl: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!school) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const [albumsCount, studentsCount, ordersCount] = await Promise.all([
      prisma.album.count({
        where: {
          schoolId,
          deletedAt: null,
        },
      }),
      prisma.schoolStudent.count({
        where: {
          schoolId,
          isActive: true,
        },
      }),
      prisma.preCompraOrder.count({
        where: {
          album: { schoolId },
        },
      }),
    ]);

    return NextResponse.json({
      school,
      summary: {
        albumsCount,
        studentsCount,
        ordersCount,
      },
    });
  } catch (err) {
    console.error("GET /api/school-organizer/schools/[schoolId]:", err);
    return NextResponse.json({ error: "Error obteniendo detalle de escuela" }, { status: 500 });
  }
}
