import { NextRequest, NextResponse } from "next/server";
import { SchoolOrganizerInvitationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerManagementAccess } from "@/lib/school-organizer-management-access";
import { createSchoolOrganizerInvitation } from "@/lib/school-organizer-invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string; invitationId: string }>;
};

function parseSchoolId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw, invitationId } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }
    if (!invitationId || invitationId.length < 5) {
      return NextResponse.json({ error: "invitationId inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerManagementAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const invitation = await prisma.schoolOrganizerInvitation.findFirst({
      where: { id: invitationId, schoolId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        school: { select: { name: true } },
      },
    });
    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 });
    }
    if (invitation.status === SchoolOrganizerInvitationStatus.ACCEPTED) {
      return NextResponse.json({ error: "La invitación ya fue aceptada." }, { status: 400 });
    }
    if (invitation.status === SchoolOrganizerInvitationStatus.CANCELLED) {
      return NextResponse.json({ error: "La invitación está cancelada." }, { status: 400 });
    }

    const result = await createSchoolOrganizerInvitation({
      schoolId,
      email: invitation.email,
      name: invitation.name || "",
      invitedByUserId: access.user.id,
      invitedByName: access.user.name,
      schoolName: invitation.school.name,
    });

    await prisma.schoolOrganizerInvitation.update({
      where: { id: invitationId },
      data: { status: SchoolOrganizerInvitationStatus.CANCELLED },
    });

    return NextResponse.json({
      invitation: result.invitation,
      emailSent: result.emailSent,
      emailError: result.emailError,
    });
  } catch (err) {
    console.error(
      "POST /api/admin/schools/[schoolId]/organizers/invite/[invitationId]/resend:",
      err
    );
    return NextResponse.json({ error: "Error reenviando invitación." }, { status: 500 });
  }
}
