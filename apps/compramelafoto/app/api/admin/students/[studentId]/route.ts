import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  buildNormalizedKey,
  normalizeFullName,
} from "@/lib/school-roster/student-normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ studentId: string }>;
};

type PatchBody = {
  firstName?: unknown;
  lastName?: unknown;
  course?: unknown;
  division?: unknown;
  shift?: unknown;
  level?: unknown;
  notes?: unknown;
  albumId?: unknown;
  rosterEntryId?: unknown;
};

function parseStudentId(raw: string): number | null {
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
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json(
        { error: error || "No autenticado. Se requiere rol ADMIN." },
        { status }
      );
    }

    const { studentId: studentIdRaw } = await params;
    const studentId = parseStudentId(studentIdRaw);
    if (!studentId) {
      return NextResponse.json({ error: "studentId inválido" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PatchBody;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        schoolId: true,
        externalStudentId: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });
    if (!student || !student.isActive) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    const nextFirstName =
      body.firstName !== undefined ? String(body.firstName ?? "").trim() : student.firstName;
    const nextLastName =
      body.lastName !== undefined ? String(body.lastName ?? "").trim() : student.lastName;

    if (!nextFirstName || !nextLastName) {
      return NextResponse.json(
        { error: "firstName y lastName son obligatorios" },
        { status: 400 }
      );
    }

    const rosterFieldsTouched =
      body.course !== undefined ||
      body.division !== undefined ||
      body.shift !== undefined ||
      body.level !== undefined ||
      body.notes !== undefined ||
      body.albumId !== undefined ||
      body.rosterEntryId !== undefined;

    const changedFields: string[] = [];

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
          schoolId: true,
          firstName: true,
          lastName: true,
          normalizedFullName: true,
        },
      });
      changedFields.push("firstName", "lastName");

      let updatedRosterEntry: {
        id: number;
        studentId: number;
        albumId: number;
        level: string;
        shift: string;
        courseName: string;
        division: string;
        notes: string | null;
      } | null = null;

      if (rosterFieldsTouched) {
        const rosterEntryId = parseNullableInt(body.rosterEntryId);
        const albumId = parseNullableInt(body.albumId);

        const rosterEntry = await tx.albumStudentRosterEntry.findFirst({
          where: rosterEntryId
            ? { id: rosterEntryId, studentId, schoolId: student.schoolId, isActive: true }
            : albumId
            ? { albumId, studentId, schoolId: student.schoolId, isActive: true }
            : { studentId, schoolId: student.schoolId, isActive: true },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            albumId: true,
            enrollmentId: true,
            level: true,
            shift: true,
            courseName: true,
            division: true,
            notes: true,
          },
        });

        if (!rosterEntry) {
          throw new Error("No se encontró la fila operativa del alumno para editar");
        }

        const nextCourse =
          body.course !== undefined
            ? String(body.course ?? "").trim()
            : rosterEntry.courseName;
        const nextDivision =
          body.division !== undefined
            ? String(body.division ?? "").trim()
            : rosterEntry.division;
        const nextShift =
          body.shift !== undefined ? String(body.shift ?? "").trim() : rosterEntry.shift;
        const nextLevel =
          body.level !== undefined ? String(body.level ?? "").trim() : rosterEntry.level;
        const nextNotes =
          body.notes !== undefined ? String(body.notes ?? "").trim() || null : rosterEntry.notes;

        if (!nextCourse || !nextDivision || !nextShift || !nextLevel) {
          throw new Error("course, division, shift y level son obligatorios");
        }

        updatedRosterEntry = await tx.albumStudentRosterEntry.update({
          where: { id: rosterEntry.id },
          data: {
            snapshotFirstName: nextFirstName,
            snapshotLastName: nextLastName,
            courseName: nextCourse,
            division: nextDivision,
            shift: nextShift,
            level: nextLevel,
            notes: nextNotes,
          },
          select: {
            id: true,
            studentId: true,
            albumId: true,
            level: true,
            shift: true,
            courseName: true,
            division: true,
            notes: true,
          },
        });
        changedFields.push("course", "division", "shift", "level", "notes");

        if (rosterEntry.enrollmentId) {
          await tx.studentEnrollment.update({
            where: { id: rosterEntry.enrollmentId },
            data: {
              courseName: nextCourse,
              division: nextDivision,
              shift: nextShift,
              level: nextLevel,
              notes: nextNotes,
            },
          });
          changedFields.push("enrollment");
        }
      } else {
        await tx.albumStudentRosterEntry.updateMany({
          where: { studentId, schoolId: student.schoolId, isActive: true },
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

    console.log("[admin_schools] student_updated", {
      adminUserId: user.id,
      studentId,
      changedFields: [...new Set(changedFields)],
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error actualizando alumno";
    const status = message.includes("obligatorios") || message.includes("No se encontró") ? 400 : 500;
    if (status === 500) {
      console.error("PATCH /api/admin/students/[studentId]:", err);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json(
        { error: error || "No autenticado. Se requiere rol ADMIN." },
        { status }
      );
    }

    const { studentId: studentIdRaw } = await params;
    const studentId = parseStudentId(studentIdRaw);
    if (!studentId) {
      return NextResponse.json({ error: "studentId inválido" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        isActive: true,
        preCompraOrders: { select: { id: true }, take: 1 },
        albumRosterEntries: {
          select: {
            id: true,
            preCompraOrders: { select: { id: true }, take: 1 },
          },
          take: 50,
        },
      },
    });
    if (!student || !student.isActive) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    const hasDirectOrders = student.preCompraOrders.length > 0;
    const hasRosterLinkedOrders = student.albumRosterEntries.some(
      (entry) => entry.preCompraOrders.length > 0
    );

    if (hasDirectOrders || hasRosterLinkedOrders) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar el alumno porque tiene preventas/pedidos asociados. Corregí datos en lugar de borrar.",
        },
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

    console.log("[admin_schools] student_deleted", {
      adminUserId: user.id,
      studentId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/students/[studentId]:", err);
    return NextResponse.json({ error: "Error eliminando alumno" }, { status: 500 });
  }
}
