import { NextRequest, NextResponse } from "next/server";
import { StudentSourceType } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerAccess } from "@/lib/school-organizer-auth";
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

function parseSchoolId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function parsePageSize(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return 100;
  return Math.min(n, 500);
}

function parseNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const searchParams = req.nextUrl.searchParams;
    const q = (searchParams.get("q") || "").trim();
    const course = (searchParams.get("course") || "").trim();
    const division = (searchParams.get("division") || "").trim();
    const shift = (searchParams.get("shift") || "").trim();
    const pageSize = parsePageSize(searchParams.get("pageSize"));

    const where = {
      schoolId,
      isActive: true,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { normalizedFullName: { contains: q.toLowerCase(), mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(course || division || shift
        ? {
            enrollments: {
              some: {
                ...(course ? { courseName: { equals: course, mode: "insensitive" as const } } : {}),
                ...(division
                  ? { division: { equals: division, mode: "insensitive" as const } }
                  : {}),
                ...(shift ? { shift: { equals: shift, mode: "insensitive" as const } } : {}),
              },
            },
          }
        : {}),
    };

    const [total, students] = await Promise.all([
      prisma.schoolStudent.count({ where }),
      prisma.schoolStudent.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          albumRosterEntries: {
            where: { isActive: true },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              id: true,
              albumId: true,
            },
          },
          enrollments: {
            orderBy: [{ updatedAt: "desc" }],
            take: 1,
            select: {
              level: true,
              shift: true,
              courseName: true,
              division: true,
            },
          },
        },
      }),
    ]);

    const studentIds = students.map((student) => student.id);
    const directOrderCounts = studentIds.length
      ? await prisma.preCompraOrder.groupBy({
          by: ["studentId"],
          where: {
            studentId: { in: studentIds },
          },
          _count: { _all: true },
        })
      : [];
    const rosterEntries = studentIds.length
      ? await prisma.albumStudentRosterEntry.findMany({
          where: {
            studentId: { in: studentIds },
          },
          select: {
            id: true,
            studentId: true,
          },
        })
      : [];
    const rosterEntryIdToStudentId = new Map(rosterEntries.map((entry) => [entry.id, entry.studentId]));
    const rosterOrderCountsByEntry = rosterEntries.length
      ? await prisma.preCompraOrder.groupBy({
          by: ["albumRosterEntryId"],
          where: {
            albumRosterEntryId: { in: rosterEntries.map((entry) => entry.id) },
          },
          _count: { _all: true },
        })
      : [];
    const directCountByStudentId = new Map(
      directOrderCounts
        .filter((row) => row.studentId != null)
        .map((row) => [row.studentId as number, row._count._all])
    );
    const rosterCountByStudentId = new Map<number, number>();
    for (const row of rosterOrderCountsByEntry) {
      if (!row.albumRosterEntryId) continue;
      const studentId = rosterEntryIdToStudentId.get(row.albumRosterEntryId);
      if (!studentId) continue;
      rosterCountByStudentId.set(studentId, (rosterCountByStudentId.get(studentId) ?? 0) + row._count._all);
    }

    const rows = students.map((student) => {
      const enrollment = student.enrollments[0] || null;
      const latestRoster = student.albumRosterEntries[0] || null;
      const preCompraOrdersCount = directCountByStudentId.get(student.id) ?? 0;
      const rosterPreCompraOrdersCount = rosterCountByStudentId.get(student.id) ?? 0;
      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        level: enrollment?.level ?? null,
        shift: enrollment?.shift ?? null,
        course: enrollment?.courseName ?? null,
        division: enrollment?.division ?? null,
        rosterEntryId: latestRoster?.id ?? null,
        albumId: latestRoster?.albumId ?? null,
        hasSensitiveRelations: preCompraOrdersCount > 0 || rosterPreCompraOrdersCount > 0,
        sensitiveRelationsSummary: {
          preCompraOrdersCount,
          rosterPreCompraOrdersCount,
        },
      };
    });

    const [courseOptionsRaw, divisionOptionsRaw, shiftOptionsRaw] = await Promise.all([
      prisma.studentEnrollment.findMany({
        where: {
          schoolId,
          status: "ACTIVE",
        },
        select: { courseName: true },
        distinct: ["courseName"],
        orderBy: { courseName: "asc" },
      }),
      prisma.studentEnrollment.findMany({
        where: {
          schoolId,
          status: "ACTIVE",
        },
        select: { division: true },
        distinct: ["division"],
        orderBy: { division: "asc" },
      }),
      prisma.studentEnrollment.findMany({
        where: {
          schoolId,
          status: "ACTIVE",
        },
        select: { shift: true },
        distinct: ["shift"],
        orderBy: { shift: "asc" },
      }),
    ]);

    return NextResponse.json({
      total,
      students: rows,
      filters: {
        courses: courseOptionsRaw.map((item) => item.courseName),
        divisions: divisionOptionsRaw.map((item) => item.division),
        shifts: shiftOptionsRaw.map((item) => item.shift),
      },
      pageSize,
    });
  } catch (err) {
    console.error("GET /api/school-organizer/schools/[schoolId]/students:", err);
    return NextResponse.json({ error: "Error obteniendo alumnos de la escuela" }, { status: 500 });
  }
}

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

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
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
        { error: "firstName, lastName, course, division, shift y level son obligatorios" },
        { status: 400 }
      );
    }
    if (body.albumId !== undefined && body.albumId !== null && albumId == null) {
      return NextResponse.json({ error: "albumId inválido" }, { status: 400 });
    }
    if (albumId == null) {
      return NextResponse.json({ error: "albumId es obligatorio" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "El álbum enviado no pertenece a la escuela" }, { status: 400 });
    }

    const duplicate = await prisma.albumStudentRosterEntry.findFirst({
      where: {
        schoolId,
        albumId,
        isActive: true,
        snapshotFirstName: { equals: firstName, mode: "insensitive" },
        snapshotLastName: { equals: lastName, mode: "insensitive" },
        courseName: { equals: course, mode: "insensitive" },
        division: { equals: division, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Ya existe un alumno similar en esa escuela/álbum" }, { status: 409 });
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
          StudentSourceType.MANUAL_ORGANIZER
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
          sourceType: StudentSourceType.MANUAL_ORGANIZER,
        });
        enrollmentId = enrollment.id;
      }

      let rosterEntry = null;
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
        sourceType: StudentSourceType.MANUAL_ORGANIZER,
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

    console.log("[school_organizer] student_created", {
      schoolId,
      organizerUserId: access.user.id,
      studentId: created.student.id,
      albumId,
    });

    return NextResponse.json(created);
  } catch (err) {
    console.error("POST /api/school-organizer/schools/[schoolId]/students:", err);
    return NextResponse.json({ error: "Error creando alumno" }, { status: 500 });
  }
}
