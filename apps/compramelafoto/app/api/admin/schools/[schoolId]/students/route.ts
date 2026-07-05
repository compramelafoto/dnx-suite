import { NextRequest, NextResponse } from "next/server";
import { Role, StudentSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  createStudentInSchool,
  ensureAlbumRosterEntry,
  findCurrentAcademicYear,
  findOrCreateEnrollmentForYear,
  findStudentInSchool,
} from "@/lib/school-roster/student-and-roster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

type PostBody = {
  firstName?: unknown;
  lastName?: unknown;
  course?: unknown;
  division?: unknown;
  shift?: unknown;
  level?: unknown;
  notes?: unknown;
  albumId?: unknown;
};

function parseId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return parseId(String(value));
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json(
        { error: error || "No autenticado. Se requiere rol ADMIN." },
        { status }
      );
    }

    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    });
    if (!school) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as PostBody;
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const course = String(body.course ?? "").trim();
    const division = String(body.division ?? "").trim();
    const shift = String(body.shift ?? "").trim();
    const level = String(body.level ?? "").trim();
    const notes = String(body.notes ?? "").trim() || null;
    const albumId = parseNullableInt(body.albumId);

    if (!firstName || !lastName || !course || !division || !shift || !level) {
      return NextResponse.json(
        {
          error:
            "firstName, lastName, course, division, shift y level son obligatorios",
        },
        { status: 400 }
      );
    }

    if (body.albumId !== undefined && body.albumId !== null && albumId == null) {
      return NextResponse.json({ error: "albumId inválido" }, { status: 400 });
    }

    let albumExists = false;
    if (albumId != null) {
      const album = await prisma.album.findFirst({
        where: { id: albumId, schoolId, deletedAt: null },
        select: { id: true },
      });
      if (!album) {
        return NextResponse.json(
          { error: "El álbum enviado no pertenece a la escuela" },
          { status: 400 }
        );
      }
      albumExists = true;
    }

    const duplicate = await prisma.albumStudentRosterEntry.findFirst({
      where: {
        schoolId,
        ...(albumId != null ? { albumId } : {}),
        isActive: true,
        snapshotFirstName: { equals: firstName, mode: "insensitive" },
        snapshotLastName: { equals: lastName, mode: "insensitive" },
        courseName: { equals: course, mode: "insensitive" },
        division: { equals: division, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Ya existe un alumno similar en esa escuela/álbum" },
        { status: 409 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      let student = await findStudentInSchool(tx, schoolId, firstName, lastName, null);
      let studentCreated = false;
      if (!student) {
        student = await createStudentInSchool(
          tx,
          schoolId,
          firstName,
          lastName,
          null,
          null,
          StudentSourceType.MANUAL_PHOTOGRAPHER
        );
        studentCreated = true;
      }

      const academicYear = await findCurrentAcademicYear(tx, schoolId);
      let enrollmentId: number | null = null;
      if (academicYear) {
        const { enrollment } = await findOrCreateEnrollmentForYear(tx, {
          studentId: student.id,
          schoolId,
          academicYearId: academicYear.id,
          level,
          shift,
          courseName: course,
          division,
          sourceType: StudentSourceType.MANUAL_PHOTOGRAPHER,
        });
        enrollmentId = enrollment.id;
      }

      let rosterEntry = null;
      if (albumExists && albumId != null) {
        const ensured = await ensureAlbumRosterEntry(tx, {
          albumId,
          schoolId,
          studentId: student.id,
          level,
          shift,
          courseName: course,
          division,
          snapshotFirstName: firstName,
          snapshotLastName: lastName,
          sourceType: StudentSourceType.MANUAL_PHOTOGRAPHER,
          isManual: true,
          enrollmentId,
        });

        rosterEntry = await tx.albumStudentRosterEntry.update({
          where: { id: ensured.entry.id },
          data: { notes },
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
      }

      return {
        student: {
          id: student.id,
          schoolId: student.schoolId,
          firstName: student.firstName,
          lastName: student.lastName,
        },
        rosterEntry,
        studentCreated,
      };
    });

    console.log("[admin_schools] student_created", {
      adminUserId: user.id,
      schoolId,
      studentId: created.student.id,
      albumId,
    });

    return NextResponse.json(created);
  } catch (err) {
    console.error("POST /api/admin/schools/[schoolId]/students:", err);
    return NextResponse.json({ error: "Error creando alumno" }, { status: 500 });
  }
}
