import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/lib/prisma";
import { StudentIdentificationMode, StudentSourceType } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";
import {
  createStudentInSchool,
  ensureAlbumRosterEntry,
  findCurrentAcademicYear,
  findOrCreateEnrollmentForYear,
  findStudentInSchool,
} from "@/lib/school-roster/student-and-roster";
import { gateTestAlbumPublicAccess } from "@/lib/public-album-test-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return {
      ok: false as const,
      error: "Faltan datos obligatorios: nivel, turno, curso, división, nombre y apellido",
    };
  }
  return {
    ok: true as const,
    value: { level, shift, courseName, division, firstName, lastName, externalStudentId, dni },
  };
}

async function assertPreventaOpenForAlbum(albumId: number): Promise<boolean> {
  const now = new Date();
  const photoCount = await prisma.photo.count({
    where: { albumId, isRemoved: false },
  });
  const packs = await listActivePacksForPublicCatalog(albumId, now, {
    hasPhotos: photoCount > 0,
  });
  return packs.length > 0;
}

function canPublicManualCreate(
  mode: StudentIdentificationMode | null,
  allowFallback: boolean
): boolean {
  const m = mode ?? StudentIdentificationMode.NONE;
  if (m === StudentIdentificationMode.MANUAL) return true;
  if (m === StudentIdentificationMode.ROSTER_OPTIONAL) return allowFallback;
  if (m === StudentIdentificationMode.ROSTER_REQUIRED) {
    return allowFallback;
  }
  return false;
}

/**
 * GET /api/public/album/[slug]/student-roster
 * Listado mínimo del padrón para la preventa pública (solo si el modo lo permite).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const slug = rawSlug?.trim();
    if (!slug) {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { publicSlug: slug, deletedAt: null },
      select: {
        id: true,
        userId: true,
        isTest: true,
        schoolId: true,
        studentIdentificationMode: true,
      },
    });

    if (!album) {
      return NextResponse.json({ error: "No disponible" }, { status: 404 });
    }

    const testGateGet = await gateTestAlbumPublicAccess({
      isTest: album.isTest,
      userId: album.userId,
    });
    if (!testGateGet.ok) {
      return testGateGet.response;
    }

    if (!album.schoolId) {
      return NextResponse.json({ error: "No disponible" }, { status: 404 });
    }

    const mode = album.studentIdentificationMode ?? StudentIdentificationMode.NONE;
    if (mode === StudentIdentificationMode.NONE || mode === StudentIdentificationMode.MANUAL) {
      return NextResponse.json({ error: "Listado no disponible" }, { status: 404 });
    }

    const open = await assertPreventaOpenForAlbum(album.id);
    if (!open) {
      return NextResponse.json({ error: "Preventa no disponible" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const level = searchParams.get("level")?.trim();
    const shift = searchParams.get("shift")?.trim();
    const courseName = searchParams.get("courseName")?.trim();
    const division = searchParams.get("division")?.trim();

    const where: Prisma.AlbumStudentRosterEntryWhereInput = {
      albumId: album.id,
      isActive: true,
    };

    if (level) where.level = level;
    if (shift) where.shift = shift;
    if (courseName) where.courseName = courseName;
    if (division) where.division = division;

    if (q) {
      where.OR = [
        { snapshotFirstName: { contains: q, mode: "insensitive" } },
        { snapshotLastName: { contains: q, mode: "insensitive" } },
      ];
    }

    const rows = await prisma.albumStudentRosterEntry.findMany({
      where,
      orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        studentId: true,
        level: true,
        shift: true,
        courseName: true,
        division: true,
        snapshotFirstName: true,
        snapshotLastName: true,
      },
    });

    return NextResponse.json({
      total: rows.length,
      entries: rows.map((e) => ({
        rosterEntryId: e.id,
        studentId: e.studentId,
        firstName: e.snapshotFirstName,
        lastName: e.snapshotLastName,
        level: e.level,
        shift: e.shift,
        courseName: e.courseName,
        division: e.division,
      })),
    });
  } catch (e) {
    console.error("GET /api/public/album/[slug]/student-roster:", e);
    return NextResponse.json({ error: "Error al cargar el padrón" }, { status: 500 });
  }
}

/**
 * POST /api/public/album/[slug]/student-roster
 * Alta manual desde la preventa (padre/tutor). Crea alumno + fila de padrón con origen MANUAL_PARENT_FALLBACK.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;
    const slug = rawSlug?.trim();
    if (!slug) {
      return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { publicSlug: slug, deletedAt: null },
      select: {
        id: true,
        userId: true,
        isTest: true,
        schoolId: true,
        studentIdentificationMode: true,
        allowManualStudentFallback: true,
      },
    });

    if (!album) {
      return NextResponse.json({ error: "No disponible" }, { status: 404 });
    }

    const testGatePost = await gateTestAlbumPublicAccess({
      isTest: album.isTest,
      userId: album.userId,
    });
    if (!testGatePost.ok) {
      return testGatePost.response;
    }

    if (!album.schoolId) {
      return NextResponse.json({ error: "No disponible" }, { status: 404 });
    }

    const open = await assertPreventaOpenForAlbum(album.id);
    if (!open) {
      return NextResponse.json({ error: "Preventa no disponible" }, { status: 404 });
    }

    if (
      !canPublicManualCreate(
        album.studentIdentificationMode ?? null,
        Boolean(album.allowManualStudentFallback)
      )
    ) {
      return NextResponse.json(
        { error: "No está permitido cargar el alumno manualmente en este álbum" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ManualBody;
    const parsed = parseManualBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const v = parsed.value;
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
          StudentSourceType.MANUAL_PARENT_FALLBACK
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
          sourceType: StudentSourceType.MANUAL_PARENT_FALLBACK,
        });
        enrollmentId = enr.id;
      }

      const { entry, created: rosterCreated } = await ensureAlbumRosterEntry(tx, {
        albumId: album.id,
        schoolId,
        studentId: student.id,
        level: v.level,
        shift: v.shift,
        courseName: v.courseName,
        division: v.division,
        snapshotFirstName: v.firstName,
        snapshotLastName: v.lastName,
        sourceType: StudentSourceType.MANUAL_PARENT_FALLBACK,
        isManual: true,
        enrollmentId,
      });

      const full = await tx.albumStudentRosterEntry.findUnique({
        where: { id: entry.id },
        select: {
          id: true,
          studentId: true,
          level: true,
          shift: true,
          courseName: true,
          division: true,
          snapshotFirstName: true,
          snapshotLastName: true,
          sourceType: true,
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
    console.error("POST /api/public/album/[slug]/student-roster:", e);
    return NextResponse.json({ error: "No se pudo guardar el alumno" }, { status: 500 });
  }
}
