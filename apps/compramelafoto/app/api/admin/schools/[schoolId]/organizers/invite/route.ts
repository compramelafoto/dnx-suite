import { NextRequest, NextResponse } from "next/server";
import { Role, SchoolOrganizerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerManagementAccess } from "@/lib/school-organizer-management-access";
import {
  createSchoolOrganizerInvitation,
  isValidEmail,
  normalizeEmail,
} from "@/lib/school-organizer-invitations";

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

    const name = String(body.name ?? "").trim();
    const email = normalizeEmail(String(body.email ?? ""));

    if (!name) {
      return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    if (targetUser && targetUser.role !== Role.SCHOOL_ORGANIZER) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email y no es usuario de escuela." },
        { status: 409 }
      );
    }

    if (targetUser && targetUser.role === Role.SCHOOL_ORGANIZER) {
      const existingMembership = await prisma.schoolOrganizer.findUnique({
        where: {
          schoolId_userId: {
            schoolId,
            userId: targetUser.id,
          },
        },
        select: { id: true, status: true },
      });

      if (!existingMembership) {
        await prisma.schoolOrganizer.create({
          data: {
            schoolId,
            userId: targetUser.id,
            status: SchoolOrganizerStatus.ACTIVE,
          },
        });
      } else if (existingMembership.status !== SchoolOrganizerStatus.ACTIVE) {
        await prisma.schoolOrganizer.update({
          where: { id: existingMembership.id },
          data: { status: SchoolOrganizerStatus.ACTIVE },
        });
      }
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true },
    });
    if (!school) {
      return NextResponse.json({ error: "Escuela no encontrada." }, { status: 404 });
    }

    const { invitation, emailSent, emailError } = await createSchoolOrganizerInvitation({
      schoolId,
      email,
      name,
      invitedByUserId: access.user.id,
      invitedByName: access.user.name,
      schoolName: school.name,
    });

    return NextResponse.json(
      {
        invitation,
        emailSent,
        emailError,
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
