import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerManagementAccess } from "@/lib/school-organizer-management-access";
import { inviteSchoolOrganizer } from "@/lib/schools/invite-organizer";

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

    const invitations = await prisma.schoolOrganizerInvitation.findMany({
      where: { schoolId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
      },
      take: 30,
    });

    return NextResponse.json({ invitations });
  } catch (err) {
    console.error("GET /api/admin/schools/[schoolId]/organizers/invite:", err);
    return NextResponse.json({ error: "Error obteniendo invitaciones" }, { status: 500 });
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

    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      email?: unknown;
    };

    const result = await inviteSchoolOrganizer({
      schoolId,
      inviter: { id: access.user.id, name: access.user.name },
      name: body.name,
      email: body.email,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      {
        invitation: result.invitation,
        emailSent: result.emailSent,
        emailError: result.emailError,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/admin/schools/[schoolId]/organizers/invite:", err);
    return NextResponse.json(
      { error: "Error enviando invitación para administrador de escuela." },
      { status: 500 }
    );
  }
}
