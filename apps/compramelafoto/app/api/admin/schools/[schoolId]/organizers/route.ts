import { NextRequest, NextResponse } from "next/server";
import { Role, SchoolOrganizerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerManagementAccess } from "@/lib/school-organizer-management-access";

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

    const access = await requireSchoolOrganizerManagementAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const organizers = await prisma.schoolOrganizer.findMany({
      where: { schoolId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ organizers });
  } catch (err) {
    console.error("GET /api/admin/schools/[schoolId]/organizers:", err);
    return NextResponse.json({ error: "Error obteniendo usuarios de escuela" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerManagementAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
    const userIdRaw = Number(body.userId);
    if (!Number.isInteger(userIdRaw) || userIdRaw <= 0) {
      return NextResponse.json({ error: "userId inválido" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userIdRaw },
      select: { id: true, role: true, name: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    if (targetUser.role !== Role.SCHOOL_ORGANIZER) {
      return NextResponse.json(
        { error: "Solo usuarios con rol SCHOOL_ORGANIZER pueden asignarse a escuelas." },
        { status: 400 }
      );
    }

    const existing = await prisma.schoolOrganizer.findUnique({
      where: {
        schoolId_userId: {
          schoolId,
          userId: targetUser.id,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });
    if (existing && existing.status === SchoolOrganizerStatus.ACTIVE) {
      return NextResponse.json(
        { error: "El usuario ya está asignado a esta escuela." },
        { status: 409 }
      );
    }

    const organizer = existing
      ? await prisma.schoolOrganizer.update({
          where: { id: existing.id },
          data: { status: SchoolOrganizerStatus.ACTIVE },
          select: {
            id: true,
            status: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        })
      : await prisma.schoolOrganizer.create({
          data: {
            schoolId,
            userId: targetUser.id,
            status: SchoolOrganizerStatus.ACTIVE,
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        });

    console.log("[admin_schools] school_organizer_added", {
      actorUserId: access.user.id,
      schoolId,
      userId: targetUser.id,
    });

    return NextResponse.json({ organizer }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/schools/[schoolId]/organizers:", err);
    return NextResponse.json({ error: "Error asignando usuario de escuela" }, { status: 500 });
  }
}
