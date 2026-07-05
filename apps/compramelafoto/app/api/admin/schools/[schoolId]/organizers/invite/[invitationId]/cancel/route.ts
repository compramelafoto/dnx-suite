import { NextRequest, NextResponse } from "next/server";
import { SchoolOrganizerInvitationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerManagementAccess } from "@/lib/school-organizer-management-access";

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
      select: { id: true, status: true },
    });
    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 });
    }
    if (invitation.status === SchoolOrganizerInvitationStatus.ACCEPTED) {
      return NextResponse.json({ error: "No se puede cancelar una invitación aceptada." }, { status: 400 });
    }

    await prisma.schoolOrganizerInvitation.update({
      where: { id: invitation.id },
      data: { status: SchoolOrganizerInvitationStatus.CANCELLED },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      "POST /api/admin/schools/[schoolId]/organizers/invite/[invitationId]/cancel:",
      err
    );
    return NextResponse.json({ error: "Error cancelando invitación." }, { status: 500 });
  }
}
