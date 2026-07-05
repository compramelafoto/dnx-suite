import { NextRequest, NextResponse } from "next/server";
import { SchoolOrganizerInvitationStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token-hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;
    const rawToken = String(token || "").trim();
    if (!rawToken) {
      return NextResponse.json({ error: "Token inválido." }, { status: 400 });
    }

    const tokenHash = hashToken(rawToken);
    const invitation = await prisma.schoolOrganizerInvitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        school: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 });
    }

    if (
      invitation.status === SchoolOrganizerInvitationStatus.PENDING &&
      invitation.expiresAt.getTime() < Date.now()
    ) {
      await prisma.schoolOrganizerInvitation.update({
        where: { id: invitation.id },
        data: { status: SchoolOrganizerInvitationStatus.EXPIRED },
      });
      return NextResponse.json(
        {
          invitation: {
            ...invitation,
            status: SchoolOrganizerInvitationStatus.EXPIRED,
            valid: false,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      invitation: {
        ...invitation,
        valid: invitation.status === SchoolOrganizerInvitationStatus.PENDING,
      },
    });
  } catch (err) {
    console.error("GET /api/school-organizer/invitations/[token]:", err);
    return NextResponse.json({ error: "Error validando invitación." }, { status: 500 });
  }
}
