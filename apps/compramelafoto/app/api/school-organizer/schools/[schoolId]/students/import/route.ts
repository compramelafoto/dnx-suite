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

type ImportBody = {
  csv?: unknown;
  albumId?: unknown;
};

type ParsedRow = {
  rowNumber: number;
  rawLine: string;
  firstName: string;
  lastName: string;
  course: string;
  division: string;
  shift: string;
  level: string;
  albumId: number | null;
};

type RowError = {
  rowNumber: number;
  message: string;
  rawLine: string;
};

function parseSchoolId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function parseNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function maybeHeader(columns: string[]): boolean {
  const first = (columns[0] || "").toLowerCase();
  const second = (columns[1] || "").toLowerCase();
  const third = (columns[2] || "").toLowerCase();
  return first.includes("nombre") && second.includes("apellido") && third.includes("curso");
}

function parseRows(csvText: string, defaultAlbumId: number | null): ParsedRow[] {
  const lines = csvText.split(/\r?\n/);
  const parsed: ParsedRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i] ?? "";
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const columns = rawLine.split(/[;,]/).map((part) => part.trim());
    if (parsed.length === 0 && maybeHeader(columns)) continue;

    const [firstName, lastName, course, division, shift, level, albumIdRaw] = columns;
    parsed.push({
      rowNumber: i + 1,
      rawLine: rawLine.trim(),
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      course: course ?? "",
      division: division ?? "",
      shift: shift ?? "",
      level: level ?? "",
      albumId: parseNullableInt(albumIdRaw) ?? defaultAlbumId,
    });
  }

  return parsed;
}

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

    const body = (await req.json().catch(() => ({}))) as ImportBody;
    const csvText = String(body.csv ?? "");
    const defaultAlbumId = parseNullableInt(body.albumId);
    if (!csvText.trim()) {
      return NextResponse.json({ error: "Pegá contenido CSV antes de importar." }, { status: 400 });
    }
    if (body.albumId !== undefined && body.albumId !== null && defaultAlbumId == null) {
      return NextResponse.json({ error: "albumId inválido" }, { status: 400 });
    }

    const schoolAlbums = await prisma.album.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true },
    });
    const albumIdSet = new Set(schoolAlbums.map((album) => album.id));

    const rows = parseRows(csvText, defaultAlbumId);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No se encontraron filas válidas para importar." }, { status: 400 });
    }

    const academicYear = await findCurrentAcademicYear(prisma, schoolId);
    const rowErrors: RowError[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      if (!row.firstName) {
        rowErrors.push({ rowNumber: row.rowNumber, message: "falta nombre", rawLine: row.rawLine });
        errorCount += 1;
        continue;
      }
      if (!row.lastName) {
        rowErrors.push({ rowNumber: row.rowNumber, message: "falta apellido", rawLine: row.rawLine });
        errorCount += 1;
        continue;
      }
      if (!row.course) {
        rowErrors.push({ rowNumber: row.rowNumber, message: "curso vacío", rawLine: row.rawLine });
        errorCount += 1;
        continue;
      }
      if (!row.division) {
        rowErrors.push({ rowNumber: row.rowNumber, message: "división vacía", rawLine: row.rawLine });
        errorCount += 1;
        continue;
      }
      if (!row.shift) {
        rowErrors.push({ rowNumber: row.rowNumber, message: "turno vacío", rawLine: row.rawLine });
        errorCount += 1;
        continue;
      }
      if (!row.level) {
        rowErrors.push({ rowNumber: row.rowNumber, message: "nivel vacío", rawLine: row.rawLine });
        errorCount += 1;
        continue;
      }
      if (row.albumId == null) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          message: "albumId faltante o inválido",
          rawLine: row.rawLine,
        });
        errorCount += 1;
        continue;
      }
      if (!albumIdSet.has(row.albumId)) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          message: "albumId no pertenece a la escuela",
          rawLine: row.rawLine,
        });
        errorCount += 1;
        continue;
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          let student = await findStudentInSchool(tx, schoolId, row.firstName, row.lastName, null);
          let studentCreated = false;
          if (!student) {
            student = await createStudentInSchool(
              tx,
              schoolId,
              row.firstName,
              row.lastName,
              null,
              null,
              StudentSourceType.MANUAL_ORGANIZER
            );
            studentCreated = true;
          }

          let enrollmentId: number | null = null;
          if (academicYear) {
            const { enrollment } = await findOrCreateEnrollmentForYear(tx, {
              studentId: student.id,
              schoolId,
              academicYearId: academicYear.id,
              level: row.level,
              shift: row.shift,
              courseName: row.course,
              division: row.division,
              sourceType: StudentSourceType.MANUAL_ORGANIZER,
            });
            enrollmentId = enrollment.id;
          }

          const { created } = await ensureAlbumRosterEntry(tx, {
            albumId: row.albumId!,
            schoolId,
            studentId: student.id,
            level: row.level,
            shift: row.shift,
            courseName: row.course,
            division: row.division,
            snapshotFirstName: row.firstName,
            snapshotLastName: row.lastName,
            sourceType: StudentSourceType.MANUAL_ORGANIZER,
            isManual: true,
            enrollmentId,
          });

          return { studentCreated, rosterCreated: created };
        });

        if (!result.rosterCreated) skippedCount += 1;
        else if (result.studentCreated) createdCount += 1;
        else updatedCount += 1;
      } catch (err) {
        errorCount += 1;
        rowErrors.push({
          rowNumber: row.rowNumber,
          message: err instanceof Error ? err.message : "error al procesar fila",
          rawLine: row.rawLine,
        });
      }
    }

    return NextResponse.json({
      totalRows: rows.length,
      createdCount,
      updatedCount,
      skippedCount,
      errorCount,
      rowErrors,
    });
  } catch (err) {
    console.error("POST /api/school-organizer/schools/[schoolId]/students/import:", err);
    return NextResponse.json({ error: "Error importando alumnos" }, { status: 500 });
  }
}
