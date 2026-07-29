import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/lib/prisma";
import { Role, StudentSourceType } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";
import { encodeCourseSlotKey, parseStoredCourseSlotKeys } from "@/lib/school-roster/course-slot-key";
import {
  createStudentInSchool,
  ensureAlbumRosterEntry,
  findCurrentAcademicYear,
  findOrCreateEnrollmentForYear,
  findStudentInSchool,
} from "@/lib/school-roster/student-and-roster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAlbumId(params: Promise<{ id: string }>) {
  const albumId = parseInt((await params).id, 10);
  if (!Number.isInteger(albumId) || albumId <= 0) return { albumId: null as number | null };
  return { albumId };
}

const ic = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** Condiciones OR para una sola cadena de búsqueda sobre fila de padrón, alumno, matrícula y pedidos asociados. */
function buildRosterGlobalSearchAnd(q: string): Prisma.AlbumStudentRosterEntryWhereInput {
  const idNum = /^\d+$/.test(q) ? parseInt(q, 10) : NaN;
  const or: Prisma.AlbumStudentRosterEntryWhereInput[] = [
    { level: ic(q) },
    { shift: ic(q) },
    { courseName: ic(q) },
    { division: ic(q) },
    { snapshotFirstName: ic(q) },
    { snapshotLastName: ic(q) },
    { notes: ic(q) },
    {
      student: {
        OR: [
          { firstName: ic(q) },
          { lastName: ic(q) },
          { normalizedFullName: ic(q) },
          { normalizedKey: ic(q) },
          { externalStudentId: ic(q) },
          { dni: ic(q) },
        ],
      },
    },
    {
      enrollment: {
        is: {
          OR: [
            { level: ic(q) },
            { shift: ic(q) },
            { courseName: ic(q) },
            { division: ic(q) },
            { notes: ic(q) },
          ],
        },
      },
    },
    {
      preCompraOrders: {
        some: {
          OR: [
            { buyerEmail: ic(q) },
            { buyerName: ic(q) },
            { buyerPhone: ic(q) },
            { studentFirstName: ic(q) },
            { studentLastName: ic(q) },
            { studentLevelSnapshot: ic(q) },
            { studentShiftSnapshot: ic(q) },
            { studentCourseSnapshot: ic(q) },
            { studentDivisionSnapshot: ic(q) },
            { studentNotes: ic(q) },
          ],
        },
      },
    },
  ];
  if (Number.isFinite(idNum) && idNum > 0) {
    or.unshift({ id: idNum });
  }
  return { OR: or };
}

/**
 * GET /api/dashboard/albums/[id]/student-roster
 * Lista padrón activo del álbum + configuración escolar del álbum.
 * Query opcional: q — búsqueda parcial en todos los campos del padrón, alumno, matrícula y pedidos preventa (comprador).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId } = await resolveAlbumId(context.params);
    if (albumId == null) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const owned = await findAlbumOwnedByUser(albumId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: {
        id: true,
        schoolId: true,
        studentIdentificationMode: true,
        allowManualStudentFallback: true,
        academicYearId: true,
        selectedCourseKeys: true,
        academicYear: { select: { id: true, label: true, isCurrent: true } },
      },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    if (album.schoolId == null) {
      return NextResponse.json(
        { error: "El álbum debe estar vinculado a una escuela para usar el padrón" },
        { status: 400 }
      );
    }

    const academicYears = await prisma.academicYear.findMany({
      where: { schoolId: album.schoolId },
      orderBy: [{ isCurrent: "desc" }, { id: "desc" }],
      select: { id: true, label: true, isCurrent: true },
    });

    const currentMarkedYear =
      academicYears.find((y) => y.isCurrent) ?? null;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";

    const where: Prisma.AlbumStudentRosterEntryWhereInput = {
      albumId,
      isActive: true,
      ...(q ? { AND: [buildRosterGlobalSearchAnd(q)] } : {}),
    };

    const entries = await prisma.albumStudentRosterEntry.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            externalStudentId: true,
            dni: true,
            normalizedFullName: true,
          },
        },
        enrollment: {
          select: {
            id: true,
            level: true,
            shift: true,
            courseName: true,
            division: true,
            academicYearId: true,
          },
        },
        _count: {
          select: { preCompraOrders: true },
        },
      },
      orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }, { id: "asc" }],
    });

    const selectedKeysArr = parseStoredCourseSlotKeys(album.selectedCourseKeys);
    const keySet = new Set(selectedKeysArr);
    let rosterStudentsInSyncedCourses = 0;
    if (keySet.size > 0) {
      const forCount = await prisma.albumStudentRosterEntry.findMany({
        where: { albumId, isActive: true },
        select: { level: true, shift: true, courseName: true, division: true },
      });
      for (const e of forCount) {
        if (keySet.has(encodeCourseSlotKey(e.level, e.shift, e.courseName, e.division))) {
          rosterStudentsInSyncedCourses += 1;
        }
      }
    }

    return NextResponse.json({
      album: {
        id: album.id,
        schoolId: album.schoolId,
        studentIdentificationMode: album.studentIdentificationMode,
        allowManualStudentFallback: album.allowManualStudentFallback,
        academicYearId: album.academicYearId,
        academicYear: album.academicYear,
        selectedCourseKeys: selectedKeysArr,
        rosterStudentsInSyncedCourses,
      },
      schoolRosterInstitutional: {
        academicYears,
        currentMarkedYear,
      },
      entries,
    });
  } catch (e) {
    console.error("GET /api/dashboard/albums/[id]/student-roster:", e);
    return NextResponse.json({ error: "Error al cargar el padrón" }, { status: 500 });
  }
}

type ManualBody = {
  level?: unknown;
  shift?: unknown;
  courseName?: unknown;
  division?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  externalStudentId?: unknown;
  dni?: unknown;
};

function parseManualBody(body: ManualBody) {
  const level = String(body.level ?? "").trim();
  const shift = String(body.shift ?? "").trim();
  const courseName = String(body.courseName ?? "").trim();
  const division = String(body.division ?? "").trim();
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const externalStudentId =
    body.externalStudentId == null || body.externalStudentId === ""
      ? null
      : String(body.externalStudentId).trim();
  const dni = body.dni == null || body.dni === "" ? null : String(body.dni).trim();

  if (!level || !shift || !courseName || !division || !firstName || !lastName) {
    return { ok: false as const, error: "Faltan campos obligatorios: level, shift, courseName, division, firstName, lastName" };
  }
  return {
    ok: true as const,
    value: { level, shift, courseName, division, firstName, lastName, externalStudentId, dni },
  };
}

/**
 * POST /api/dashboard/albums/[id]/student-roster
 * Alta manual de alumno en el padrón del álbum.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { albumId } = await resolveAlbumId(context.params);
    if (albumId == null) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const owned = await findAlbumOwnedByUser(albumId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as ManualBody;
    const parsed = parseManualBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const v = parsed.value;

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true, schoolId: true },
    });
    if (!album?.schoolId) {
      return NextResponse.json(
        { error: "El álbum debe estar vinculado a una escuela" },
        { status: 400 }
      );
    }

    const schoolId = album.schoolId;

    const result = await prisma.$transaction(async (tx) => {
      let student = await findStudentInSchool(tx, schoolId, v.firstName, v.lastName, v.externalStudentId, v.dni);
      let studentCreated = false;
      if (!student) {
        student = await createStudentInSchool(
          tx,
          schoolId,
          v.firstName,
          v.lastName,
          v.externalStudentId,
          v.dni,
          StudentSourceType.MANUAL_PHOTOGRAPHER
        );
        studentCreated = true;
      }

      const year = await findCurrentAcademicYear(tx, schoolId);
      let enrollmentId: number | null = null;
      if (year) {
        const { enrollment: enr } = await findOrCreateEnrollmentForYear(tx, {
          studentId: student.id,
          schoolId,
          academicYearId: year.id,
          level: v.level,
          shift: v.shift,
          courseName: v.courseName,
          division: v.division,
          sourceType: StudentSourceType.MANUAL_PHOTOGRAPHER,
        });
        enrollmentId = enr.id;
      }

      const { entry, created: rosterCreated } = await ensureAlbumRosterEntry(tx, {
        albumId,
        schoolId,
        studentId: student.id,
        level: v.level,
        shift: v.shift,
        courseName: v.courseName,
        division: v.division,
        snapshotFirstName: v.firstName,
        snapshotLastName: v.lastName,
        sourceType: StudentSourceType.MANUAL_PHOTOGRAPHER,
        isManual: true,
        enrollmentId,
      });

      const full = await tx.albumStudentRosterEntry.findUnique({
        where: { id: entry.id },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              externalStudentId: true,
              dni: true,
              normalizedFullName: true,
            },
          },
          enrollment: true,
        },
      });

      return {
        rosterEntry: full,
        studentCreated,
        rosterCreated,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("POST /api/dashboard/albums/[id]/student-roster:", e);
    return NextResponse.json({ error: "Error al agregar al padrón" }, { status: 500 });
  }
}
