import { Prisma, StudentSourceType, type AlbumStudentRosterEntry, type SchoolStudent, type StudentEnrollment } from "@/lib/prisma";
import { buildNormalizedKey, normalizeDniForComparison, normalizeFullName, normalizePersonNamePart } from "./student-normalize";

export type Tx = Prisma.TransactionClient;

export async function findStudentInSchoolWithDniMeta(
  tx: Tx,
  schoolId: number,
  firstName: string,
  lastName: string,
  externalStudentId: string | null | undefined,
  dni?: string | null | undefined
): Promise<{ student: SchoolStudent | null; ambiguousDniMatch: boolean }> {
  const ext = externalStudentId?.trim();
  if (ext) {
    const byExt = await tx.schoolStudent.findFirst({
      where: { schoolId, externalStudentId: ext },
    });
    if (byExt) return { student: byExt, ambiguousDniMatch: false };
  }

  const normDni = normalizeDniForComparison(dni ?? null);
  if (normDni) {
    const byDniRows = await tx.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT s.id
      FROM "SchoolStudent" s
      WHERE s."schoolId" = ${schoolId}
        AND regexp_replace(lower(trim(coalesce(s.dni, ''))), '[\\s\\.\\-_]', '', 'g') = ${normDni}
      LIMIT 3
    `);
    if (byDniRows.length > 1) {
      const s = await tx.schoolStudent.findUnique({ where: { id: byDniRows[0].id } });
      return { student: s, ambiguousDniMatch: true };
    }
    if (byDniRows.length === 1) {
      const s = await tx.schoolStudent.findUnique({ where: { id: byDniRows[0].id } });
      return { student: s, ambiguousDniMatch: false };
    }
  }

  const fn = normalizePersonNamePart(firstName);
  const ln = normalizePersonNamePart(lastName);
  const byName = await tx.schoolStudent.findFirst({
    where: {
      schoolId,
      firstName: { equals: fn, mode: "insensitive" },
      lastName: { equals: ln, mode: "insensitive" },
    },
  });
  return { student: byName, ambiguousDniMatch: false };
}

/**
 * Resolución de alumno en la escuela (deduplicación institucional).
 * Orden: 1) externalStudentId / matrícula 2) DNI normalizado 3) nombre y apellido (insensible a mayúsculas, espacios colapsados).
 */
export async function findStudentInSchool(
  tx: Tx,
  schoolId: number,
  firstName: string,
  lastName: string,
  externalStudentId: string | null | undefined,
  dni?: string | null | undefined
): Promise<SchoolStudent | null> {
  const { student } = await findStudentInSchoolWithDniMeta(
    tx,
    schoolId,
    firstName,
    lastName,
    externalStudentId,
    dni
  );
  return student;
}

export async function createStudentInSchool(
  tx: Tx,
  schoolId: number,
  firstName: string,
  lastName: string,
  externalStudentId: string | null | undefined,
  dni: string | null | undefined,
  sourceType: StudentSourceType
): Promise<SchoolStudent> {
  const ext = externalStudentId?.trim() || null;
  const dniVal = dni?.trim() || null;
  const fnStore = normalizePersonNamePart(firstName);
  const lnStore = normalizePersonNamePart(lastName);
  const nFull = normalizeFullName(fnStore, lnStore);
  const nKey = buildNormalizedKey(schoolId, fnStore, lnStore, ext);
  return tx.schoolStudent.create({
    data: {
      schoolId,
      externalStudentId: ext,
      dni: dniVal,
      firstName: fnStore,
      lastName: lnStore,
      normalizedFullName: nFull,
      normalizedKey: nKey,
      sourceType,
      isActive: true,
    },
  });
}

export async function findCurrentAcademicYear(tx: Tx, schoolId: number) {
  return tx.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    orderBy: { id: "asc" },
  });
}

/**
 * Año lectivo explícito si es válido para la escuela; si no hay id, el año actual marcado en la escuela.
 */
export async function resolveAcademicYearForImport(tx: Tx, schoolId: number, academicYearId?: number | null) {
  if (academicYearId != null && Number.isInteger(academicYearId) && academicYearId > 0) {
    const y = await tx.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
    });
    if (y) return y;
  }
  return findCurrentAcademicYear(tx, schoolId);
}

export async function findOrCreateEnrollmentForYear(
  tx: Tx,
  params: {
    studentId: number;
    schoolId: number;
    academicYearId: number;
    level: string;
    shift: string;
    courseName: string;
    division: string;
    sourceType: StudentSourceType;
  }
): Promise<{ enrollment: StudentEnrollment; created: boolean }> {
  const existing = await tx.studentEnrollment.findFirst({
    where: {
      studentId: params.studentId,
      academicYearId: params.academicYearId,
    },
  });
  if (existing) return { enrollment: existing, created: false };
  const enrollment = await tx.studentEnrollment.create({
    data: {
      studentId: params.studentId,
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      level: params.level.trim(),
      shift: params.shift.trim(),
      courseName: params.courseName.trim(),
      division: params.division.trim(),
      status: "ACTIVE",
      sourceType: params.sourceType,
    },
  });
  return { enrollment, created: true };
}

/**
 * Crea o devuelve la entrada de padrón para (álbum, alumno).
 * Si ya existía, devuelve la fila sin modificar datos (idempotente).
 */
export async function ensureAlbumRosterEntry(
  tx: Tx,
  params: {
    albumId: number;
    schoolId: number;
    studentId: number;
    level: string;
    shift: string;
    courseName: string;
    division: string;
    snapshotFirstName: string;
    snapshotLastName: string;
    sourceType: StudentSourceType;
    isManual: boolean;
    enrollmentId: number | null;
  }
): Promise<{ entry: AlbumStudentRosterEntry; created: boolean }> {
  const existing = await tx.albumStudentRosterEntry.findFirst({
    where: {
      albumId: params.albumId,
      studentId: params.studentId,
    },
  });
  if (existing) {
    return { entry: existing, created: false };
  }
  const entry = await tx.albumStudentRosterEntry.create({
    data: {
      albumId: params.albumId,
      schoolId: params.schoolId,
      studentId: params.studentId,
      enrollmentId: params.enrollmentId,
      level: params.level.trim(),
      shift: params.shift.trim(),
      courseName: params.courseName.trim(),
      division: params.division.trim(),
      snapshotFirstName: normalizePersonNamePart(params.snapshotFirstName),
      snapshotLastName: normalizePersonNamePart(params.snapshotLastName),
      sourceType: params.sourceType,
      isManual: params.isManual,
      isActive: true,
    },
  });
  return { entry, created: true };
}

export type RosterImportReconcileOutcome =
  | "created"
  | "updated"
  | "unchanged"
  /** Hay pedidos preventa vinculados a la entrada de padrón; no se modifica snapshot ni curso por defecto */
  | "blocked_orders"
  /** Entrada alta manual explícita; no se pis con importación CSV */
  | "blocked_manual"
  /** Fotógrafo marcó snapshot local preservado (`hasLocalOverrides`); sync/import no pis */
  | "blocked_has_local_overrides";

/**
 * Alta o fusión conservadora del snapshot de álbum ante importaciones.
 * No elimina filas. No sobrescribe entradas con pedidos {@link PreCompraOrder.albumRosterEntryId}.
 */
export async function reconcileAlbumRosterEntryForImport(
  tx: Tx,
  params: {
    albumId: number;
    schoolId: number;
    studentId: number;
    level: string;
    shift: string;
    courseName: string;
    division: string;
    snapshotFirstName: string;
    snapshotLastName: string;
    sourceType: StudentSourceType;
    enrollmentId: number | null;
  }
): Promise<{ entry: AlbumStudentRosterEntry; outcome: RosterImportReconcileOutcome }> {
  const level = params.level.trim();
  const shift = params.shift.trim();
  const courseName = params.courseName.trim();
  const division = params.division.trim();
  const snapshotFirstName = normalizePersonNamePart(params.snapshotFirstName);
  const snapshotLastName = normalizePersonNamePart(params.snapshotLastName);

  const existing = await tx.albumStudentRosterEntry.findFirst({
    where: { albumId: params.albumId, studentId: params.studentId },
  });

  if (!existing) {
    const entry = await tx.albumStudentRosterEntry.create({
      data: {
        albumId: params.albumId,
        schoolId: params.schoolId,
        studentId: params.studentId,
        enrollmentId: params.enrollmentId,
        level,
        shift,
        courseName,
        division,
        snapshotFirstName,
        snapshotLastName,
        sourceType: params.sourceType,
        isManual: false,
        isActive: true,
      },
    });
    return { entry, outcome: "created" };
  }

  const orderCount = await tx.preCompraOrder.count({
    where: { albumRosterEntryId: existing.id },
  });
  if (orderCount > 0) {
    return { entry: existing, outcome: "blocked_orders" };
  }
  if (existing.isManual) {
    return { entry: existing, outcome: "blocked_manual" };
  }
  if (existing.hasLocalOverrides) {
    return { entry: existing, outcome: "blocked_has_local_overrides" };
  }

  const nextEnrollmentId =
    params.enrollmentId != null ? params.enrollmentId : existing.enrollmentId ?? null;

  const unchanged =
    existing.level.trim() === level &&
    existing.shift.trim() === shift &&
    existing.courseName.trim() === courseName &&
    existing.division.trim() === division &&
    existing.snapshotFirstName.trim() === snapshotFirstName &&
    existing.snapshotLastName.trim() === snapshotLastName &&
    (existing.enrollmentId ?? null) === (nextEnrollmentId ?? null);

  if (unchanged) {
    return { entry: existing, outcome: "unchanged" };
  }

  const nextSyncEnrollmentId =
    params.enrollmentId != null
      ? params.enrollmentId
      : existing.syncSourceEnrollmentId ?? nextEnrollmentId;

  const updated = await tx.albumStudentRosterEntry.update({
    where: { id: existing.id },
    data: {
      level,
      shift,
      courseName,
      division,
      snapshotFirstName,
      snapshotLastName,
      enrollmentId: nextEnrollmentId,
      syncSourceEnrollmentId: nextSyncEnrollmentId,
      sourceType: params.sourceType,
      isOutdatedFromEnrollment: false,
      institutionalStaleReason: null,
    },
  });
  return { entry: updated, outcome: "updated" };
}
