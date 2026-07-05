import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerManagementAccess } from "@/lib/school-organizer-management-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string; id: string }>;
};

function parseSchoolId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw, id } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }
    if (!id || id.length < 5) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerManagementAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const membership = await prisma.schoolOrganizer.findFirst({
      where: {
        id,
        schoolId,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
    }

    await prisma.schoolOrganizer.delete({
      where: { id: membership.id },
    });

    console.log("[admin_schools] school_organizer_removed", {
      actorUserId: access.user.id,
      schoolId,
      userId: membership.userId,
      membershipId: membership.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/schools/[schoolId]/organizers/[id]:", err);
    return NextResponse.json({ error: "Error removiendo acceso de usuario" }, { status: 500 });
  }
}
