import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Role, SchoolOrganizerInvitationStatus, SchoolOrganizerStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token-hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;
    const rawToken = String(token || "").trim();
    if (!rawToken) {
      return NextResponse.json({ error: "Token inválido." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { password?: unknown };
    const password = String(body.password ?? "");
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(rawToken);
    const invitation = await prisma.schoolOrganizerInvitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        schoolId: true,
        email: true,
        name: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 });
    }
    if (invitation.status === SchoolOrganizerInvitationStatus.ACCEPTED) {
      return NextResponse.json({ error: "La invitación ya fue aceptada." }, { status: 400 });
    }
    if (invitation.status === SchoolOrganizerInvitationStatus.CANCELLED) {
      return NextResponse.json({ error: "La invitación fue cancelada." }, { status: 400 });
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await prisma.schoolOrganizerInvitation.update({
        where: { id: invitation.id },
        data: { status: SchoolOrganizerInvitationStatus.EXPIRED },
      });
      return NextResponse.json({ error: "La invitación está expirada." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: invitation.email },
        select: { id: true, role: true },
      });

      if (existingUser && existingUser.role !== Role.SCHOOL_ORGANIZER) {
        throw new Error("Ya existe un usuario con ese email y no es usuario de escuela.");
      }

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              ...(invitation.name ? { name: invitation.name } : {}),
              password: passwordHash,
            },
            select: { id: true, email: true, name: true, role: true },
          })
        : await tx.user.create({
            data: {
              email: invitation.email,
              name: invitation.name || null,
              password: passwordHash,
              role: Role.SCHOOL_ORGANIZER,
            },
            select: { id: true, email: true, name: true, role: true },
          });

      const existingMembership = await tx.schoolOrganizer.findUnique({
        where: {
          schoolId_userId: {
            schoolId: invitation.schoolId,
            userId: user.id,
          },
        },
        select: { id: true },
      });

      if (existingMembership) {
        await tx.schoolOrganizer.update({
          where: { id: existingMembership.id },
          data: { status: SchoolOrganizerStatus.ACTIVE },
        });
      } else {
        await tx.schoolOrganizer.create({
          data: {
            schoolId: invitation.schoolId,
            userId: user.id,
            status: SchoolOrganizerStatus.ACTIVE,
          },
        });
      }

      await tx.schoolOrganizerInvitation.update({
        where: { id: invitation.id },
        data: {
          status: SchoolOrganizerInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      return user;
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
      },
      redirectTo: "/login",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error aceptando invitación de administrador.";
    const status =
      message === "Ya existe un usuario con ese email y no es usuario de escuela." ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
