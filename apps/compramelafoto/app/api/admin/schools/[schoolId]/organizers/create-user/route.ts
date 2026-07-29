import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@repo/auth";
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
      password?: unknown;
    };

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");

    if (!name) {
      return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña temporal debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true },
    });

    if (existingUser && existingUser.role !== Role.SCHOOL_ORGANIZER) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email y no es usuario de escuela." },
        { status: 409 }
      );
    }

    if (existingUser && existingUser.role === Role.SCHOOL_ORGANIZER) {
      const existingMembership = await prisma.schoolOrganizer.findUnique({
        where: { schoolId_userId: { schoolId, userId: existingUser.id } },
        select: { id: true, status: true, createdAt: true },
      });

      if (existingMembership && existingMembership.status === SchoolOrganizerStatus.ACTIVE) {
        return NextResponse.json(
          { error: "El usuario ya está asignado a esta escuela." },
          { status: 409 }
        );
      }

      const membership = existingMembership
        ? await prisma.schoolOrganizer.update({
            where: { id: existingMembership.id },
            data: { status: SchoolOrganizerStatus.ACTIVE },
            select: { id: true, status: true, createdAt: true },
          })
        : await prisma.schoolOrganizer.create({
            data: {
              schoolId,
              userId: existingUser.id,
              status: SchoolOrganizerStatus.ACTIVE,
            },
            select: { id: true, status: true, createdAt: true },
          });

      return NextResponse.json({
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
        },
        membership,
        reusedExistingUser: true,
        temporaryPasswordReturned: false,
      });
    }

    const passwordHash = hashPassword(password);
    const { user, membership } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role: Role.SCHOOL_ORGANIZER,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const createdMembership = await tx.schoolOrganizer.create({
        data: {
          schoolId,
          userId: createdUser.id,
          status: SchoolOrganizerStatus.ACTIVE,
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      });

      return { user: createdUser, membership: createdMembership };
    });

    console.log("[admin_schools] school_organizer_user_created", {
      actorUserId: access.user.id,
      schoolId,
      userId: user.id,
      membershipId: membership.id,
    });

    return NextResponse.json(
      {
        user,
        membership,
        reusedExistingUser: false,
        temporaryPasswordReturned: true,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/admin/schools/[schoolId]/organizers/create-user:", err);
    return NextResponse.json(
      { error: "Error creando usuario SCHOOL_ORGANIZER para la escuela" },
      { status: 500 }
    );
  }
}
