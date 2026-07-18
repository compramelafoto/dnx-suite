import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerAccess } from "@/lib/school-organizer-auth";
import { buildNormalizedKey, normalizeFullName } from "@/lib/school-roster/student-normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string; studentId: string }>;
};

type PatchBody = {
  firstName?: unknown;
  lastName?: unknown;
  course?: unknown;
  division?: unknown;
  shift?: unknown;
  level?: unknown;
  albumId?: unknown;
  rosterEntryId?: unknown;
};

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw, studentId: studentIdRaw } = await params;
    const schoolId = parseId(schoolIdRaw);
    const studentId = parseId(studentIdRaw);
    if (!schoolId || !studentId) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = (await req.json().catch(() => ({}))) as PatchBody;

    const student = await prisma.schoolStudent.findFirst({
      where: { id: studentId, schoolId, isActive: true },
      select: {
        id: true,
        schoolId: true,
        externalStudentId: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!student) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    const nextFirstName =
      body.firstName !== undefined ? String(body.firstName ?? "").trim() : student.firstName;
    const nextLastName =
      body.lastName !== undefined ? String(body.lastName ?? "").trim() : student.lastName;
    if (!nextFirstName || !nextLastName) {
      return NextResponse.json({ error: "firstName y lastName son obligatorios" }, { status: 400 });
    }

    const rosterFieldsTouched =
      body.course !== undefined ||
      body.division !== undefined ||
      body.shift !== undefined ||
      body.level !== undefined ||
      body.albumId !== undefined ||
      body.rosterEntryId !== undefined;

    const result = await prisma.$transaction(async (tx) => {
      const updatedStudent = await tx.student.update({
        where: { id: studentId },
        data: {
          firstName: nextFirstName,
          lastName: nextLastName,
          normalizedFullName: normalizeFullName(nextFirstName, nextLastName),
          normalizedKey: buildNormalizedKey(
            student.schoolId,
            nextFirstName,
            nextLastName,
            student.externalStudentId
          ),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      let updatedRosterEntry: {
        id: number;
        studentId: number;
        albumId: number;
        level: string;
        shift: string;
        courseName: string;
        division: string;
      } | null = null;

      if (rosterFieldsTouched) {
        const rosterEntryId = parseNullableInt(body.rosterEntryId);
        const albumId = parseNullableInt(body.albumId);
        const rosterEntry = await tx.albumStudentRosterEntry.findFirst({
          where: rosterEntryId
            ? { id: rosterEntryId, studentId, schoolId, isActive: true }
            : albumId
            ? { albumId, studentId, schoolId, isActive: true }
            : { studentId, schoolId, isActive: true },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            albumId: true,
            enrollmentId: true,
            level: true,
            shift: true,
            courseName: true,
            division: true,
          },
        });
        const fallbackEnrollment = !rosterEntry
          ? await tx.studentEnrollment.findFirst({
              where: {
                studentId,
                schoolId,
                status: "ACTIVE",
              },
              orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                level: true,
                shift: true,
                courseName: true,
                division: true,
              },
            })
          : null;

        const nextCourse =
          body.course !== undefined
            ? String(body.course ?? "").trim()
            : rosterEntry?.courseName ?? fallbackEnrollment?.courseName ?? "";
        const nextDivision =
          body.division !== undefined
            ? String(body.division ?? "").trim()
            : rosterEntry?.division ?? fallbackEnrollment?.division ?? "";
        const nextShift =
          body.shift !== undefined
            ? String(body.shift ?? "").trim()
            : rosterEntry?.shift ?? fallbackEnrollment?.shift ?? "";
        const nextLevel =
          body.level !== undefined
            ? String(body.level ?? "").trim()
            : rosterEntry?.level ?? fallbackEnrollment?.level ?? "";

        if (!nextCourse || !nextDivision || !nextShift || !nextLevel) {
          throw new Error("course, division, shift y level son obligatorios");
        }

        if (rosterEntry) {
          updatedRosterEntry = await tx.albumStudentRosterEntry.update({
            where: { id: rosterEntry.id },
            data: {
              snapshotFirstName: nextFirstName,
              snapshotLastName: nextLastName,
              courseName: nextCourse,
              division: nextDivision,
              shift: nextShift,
              level: nextLevel,
            },
            select: {
              id: true,
              studentId: true,
              albumId: true,
              level: true,
              shift: true,
              courseName: true,
              division: true,
            },
          });
        }

        if (rosterEntry?.enrollmentId) {
          await tx.studentEnrollment.update({
            where: { id: rosterEntry.enrollmentId },
            data: {
              courseName: nextCourse,
              division: nextDivision,
              shift: nextShift,
              level: nextLevel,
            },
          });
        } else if (fallbackEnrollment?.id) {
          await tx.studentEnrollment.update({
            where: { id: fallbackEnrollment.id },
            data: {
              courseName: nextCourse,
              division: nextDivision,
              shift: nextShift,
              level: nextLevel,
            },
          });
        }
      } else {
        await tx.albumStudentRosterEntry.updateMany({
          where: { studentId, schoolId, isActive: true },
          data: {
            snapshotFirstName: nextFirstName,
            snapshotLastName: nextLastName,
          },
        });
      }

      return {
        student: updatedStudent,
        rosterEntry: updatedRosterEntry,
      };
    });

    console.log("[school_organizer] student_updated", {
      schoolId,
      organizerUserId: access.user.id,
      studentId,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error actualizando alumno";
    const status = message.includes("obligatorios") || message.includes("No se encontró") ? 400 : 500;
    if (status === 500) {
      console.error("PATCH /api/school-organizer/schools/[schoolId]/students/[studentId]:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw, studentId: studentIdRaw } = await params;
    const schoolId = parseId(schoolIdRaw);
    const studentId = parseId(studentIdRaw);
    if (!schoolId || !studentId) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const student = await prisma.schoolStudent.findFirst({
      where: { id: studentId, schoolId, isActive: true },
      select: {
        id: true,
        preCompraOrders: { select: { id: true }, take: 1 },
        albumRosterEntries: {
          where: { isActive: true },
          select: {
            id: true,
            preCompraOrders: { select: { id: true }, take: 1 },
          },
          take: 100,
        },
      },
    });
    if (!student) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    const hasDirectOrders = student.preCompraOrders.length > 0;
    const hasRosterLinkedOrders = student.albumRosterEntries.some(
      (entry) => entry.preCompraOrders.length > 0
    );
    if (hasDirectOrders || hasRosterLinkedOrders) {
      return NextResponse.json(
        { error: "Este alumno tiene compras asociadas y no puede eliminarse." },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.albumStudentRosterEntry.updateMany({
        where: { studentId },
        data: { isActive: false },
      });
      await tx.studentEnrollment.updateMany({
        where: { studentId },
        data: { status: "INACTIVE" },
      });
      await tx.student.update({
        where: { id: studentId },
        data: { isActive: false },
      });
    });

    console.log("[school_organizer] student_deleted", {
      schoolId,
      organizerUserId: access.user.id,
      studentId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/school-organizer/schools/[schoolId]/students/[studentId]:", err);
    return NextResponse.json({ error: "Error eliminando alumno" }, { status: 500 });
  }
}
