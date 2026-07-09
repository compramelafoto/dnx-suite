import {
  type PrismaClient,
  RosterImportRowStatus,
  RosterImportStatus,
  StudentSourceType,
} from "@/lib/prisma";
import { parseCsvRoster } from "./parse-csv-roster";
import {
  createStudentInSchool,
  findOrCreateEnrollmentForYear,
  findStudentInSchoolWithDniMeta,
  reconcileAlbumRosterEntryForImport,
  resolveAcademicYearForImport,
} from "./student-and-roster";

export class StudentRosterImportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "StudentRosterImportError";
    this.status = status;
  }
}

export type ImportStudentRosterInput = {
  prisma: PrismaClient;
  albumId: number;
  actorUserId: number;
  csvText: string;
  fileName: string;
  importMode: "csv" | "xlsx";
  /** Si viene y existe en la escuela, usa este año lectivo; si no, año marcado como actual (`isCurrent`) */
  academicYearId?: number | null;
};

export type ImportStudentRosterSummary = {
  totalRows: number;
  /** Alumnos (Student) creados en esta importación */
  studentsCreated: number;
  /** Alumnos ya existentes reutilizados */
  studentsReused: number;
  /** Filas donde el DNI en archivo coincidía con más de un alumno en BD (advertencia operativa; se usa el primero encontrado) */
  duplicateDniMatches: number;
  /** StudentEnrollment nuevos para el año elegido */
  enrollmentsCreated: number;
  /** Matrícula anual ya existente reutilizada */
  enrollmentsReused: number;
  /** Snapshot de álbum nuevo (AlbumStudentRosterEntry) */
  rosterLinksCreated: number;
  /** Ya estaba enlazado al álbum; datos idénticos, sin tocar */
  rosterLinksUnchanged: number;
  /** Snapshot actualizado (sin pedidos preventa vinculados) */
  rosterLinksUpdated: number;
  /** Entrada existente con pedidos preventa; no se modificó */
  rosterLinksSkippedDueToOrders: number;
  /** Entrada manual; no se sobrescribe por importación */
  rosterLinksSkippedManual: number;
  /** Snapshot marcado como override local preservado (`hasLocalOverrides`) */
  rosterLinksSkippedLocalOverrides: number;
  /** Errores de validación / transacción por fila */
  errorCount: number;
  rowErrors: Array<{ rowNumber: number; message: string }>;
};

export type ImportStudentRosterResult = ImportStudentRosterSummary & {
  batchId: number;
  /** Compatibilidad con clientes antiguos (≈ alumnos nuevos) */
  createdCount: number;
  /** Compatibilidad (≈ alumnos reutilizados) */
  updatedCount: number;
  /** Compatibilidad: filas sin alta de vínculo nuevo ni actualización efectiva del snapshot de álbum */
  skippedCount: number;
};

export async function importStudentRosterForAlbum(
  input: ImportStudentRosterInput
): Promise<ImportStudentRosterResult> {
  const { prisma, albumId, actorUserId, csvText, fileName, importMode, academicYearId } = input;

  if (!csvText.trim()) {
    throw new StudentRosterImportError("El archivo está vacío");
  }

  let rows: ReturnType<typeof parseCsvRoster>;
  try {
    rows = parseCsvRoster(csvText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Archivo inválido";
    throw new StudentRosterImportError(message, 400);
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, schoolId: true },
  });
  if (!album) {
    throw new StudentRosterImportError("Álbum no encontrado", 404);
  }
  if (!album.schoolId) {
    throw new StudentRosterImportError("El álbum debe estar vinculado a una escuela", 400);
  }

  const schoolId = album.schoolId;

  let studentsCreated = 0;
  let studentsReused = 0;
  let duplicateDniMatches = 0;
  let enrollmentsCreated = 0;
  let enrollmentsReused = 0;
  let rosterLinksCreated = 0;
  let rosterLinksUnchanged = 0;
  let rosterLinksUpdated = 0;
  let rosterLinksSkippedDueToOrders = 0;
  let rosterLinksSkippedManual = 0;
  let rosterLinksSkippedLocalOverrides = 0;
  let errorCount = 0;
  const rowErrors: Array<{ rowNumber: number; message: string }> = [];

  const yearEarly = await resolveAcademicYearForImport(prisma, schoolId, academicYearId);

  const batch = await prisma.studentRosterImportBatch.create({
    data: {
      schoolId,
      albumId,
      academicYearId: yearEarly?.id ?? null,
      uploadedByUserId: actorUserId,
      fileName,
      importMode,
      status: RosterImportStatus.PENDING,
      rowCount: rows.length,
    },
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    const rawRowJson = { ...row } as object;

    const requiredOk =
      row.level.trim() &&
      row.shift.trim() &&
      row.courseName.trim() &&
      row.division.trim() &&
      row.firstName.trim() &&
      row.lastName.trim();

    if (!requiredOk) {
      errorCount += 1;
      rowErrors.push({
        rowNumber,
        message: "Faltan campos obligatorios en la fila",
      });
      await prisma.studentRosterImportRow.create({
        data: {
          batchId: batch.id,
          rowNumber,
          level: row.level || null,
          shift: row.shift || null,
          courseName: row.courseName || null,
          division: row.division || null,
          firstName: row.firstName || null,
          lastName: row.lastName || null,
          externalStudentId: row.externalStudentId,
          dni: row.dni,
          rawRowJson,
          status: RosterImportRowStatus.ERROR,
          message: "Faltan campos obligatorios en la fila",
        },
      });
      continue;
    }

    try {
      const delta = await prisma.$transaction(async (tx) => {
        const year = await resolveAcademicYearForImport(tx, schoolId, academicYearId);

        const { student: foundStudent, ambiguousDniMatch } = await findStudentInSchoolWithDniMeta(
          tx,
          schoolId,
          row.firstName,
          row.lastName,
          row.externalStudentId,
          row.dni
        );
        let student = foundStudent;
        const newStudent = !student;

        if (!student) {
          student = await createStudentInSchool(
            tx,
            schoolId,
            row.firstName,
            row.lastName,
            row.externalStudentId,
            row.dni,
            StudentSourceType.IMPORT
          );
        }
        if (!student) {
          throw new Error("IMPORT_STUDENT_RESOLVE_FAILED");
        }

        let enrollmentId: number | null = null;
        let enrollmentJustCreated = false;
        let enrollmentReuse = false;
        if (year) {
          const { enrollment, created: enCreated } = await findOrCreateEnrollmentForYear(tx, {
            studentId: student.id,
            schoolId,
            academicYearId: year.id,
            level: row.level,
            shift: row.shift,
            courseName: row.courseName,
            division: row.division,
            sourceType: StudentSourceType.IMPORT,
          });
          enrollmentId = enrollment.id;
          enrollmentJustCreated = enCreated;
          enrollmentReuse = !enCreated;
        }

        const roster = await reconcileAlbumRosterEntryForImport(tx, {
          albumId,
          schoolId,
          studentId: student.id,
          level: row.level,
          shift: row.shift,
          courseName: row.courseName,
          division: row.division,
          snapshotFirstName: row.firstName,
          snapshotLastName: row.lastName,
          sourceType: StudentSourceType.IMPORT,
          enrollmentId,
        });

        let rowStatus: RosterImportRowStatus;
        let rowMessage: string;

        switch (roster.outcome) {
          case "created":
            rowStatus = newStudent ? RosterImportRowStatus.CREATED : RosterImportRowStatus.MATCHED;
            rowMessage = ambiguousDniMatch
              ? "Vínculo al álbum nuevo (advertencia: DNI ambiguo en base; se eligió primer registro)"
              : newStudent
                ? "Alumno nuevo e inscripto en álbum"
                : "Alumno existente: vínculo al álbum nuevo";
            break;
          case "updated":
            rowStatus = RosterImportRowStatus.UPDATED;
            rowMessage = ambiguousDniMatch
              ? "Snapshot actualizado (DNI ambiguo en escuela)"
              : "Actualizado snapshot / curso en el álbum sin pedidos asociados";
            break;
          case "unchanged":
            rowStatus = RosterImportRowStatus.SKIPPED_DUPLICATE;
            rowMessage = ambiguousDniMatch
              ? "Ya en el padrón sin cambios (DNI ambiguo)"
              : "Ya existía en el padrón del álbum sin cambios";
            break;
          case "blocked_orders":
            rowStatus = RosterImportRowStatus.SKIPPED_DUPLICATE;
            rowMessage =
              "Entrada ya en álbum con pedidos preventa vinculados; no se modificó el snapshot institucional del álbum";
            break;
          case "blocked_manual":
            rowStatus = RosterImportRowStatus.SKIPPED_DUPLICATE;
            rowMessage = "Entrada manual en álbum no actualizada desde importación automatizada";
            break;
          case "blocked_has_local_overrides":
            rowStatus = RosterImportRowStatus.SKIPPED_DUPLICATE;
            rowMessage =
              "Entrada en álbum con snapshot local preservado (`hasLocalOverrides`); importación institucional no la modifica.";
            break;
          default:
            rowStatus = RosterImportRowStatus.ERROR;
            rowMessage = "Resultado no esperado";
        }

        await tx.studentRosterImportRow.create({
          data: {
            batchId: batch.id,
            rowNumber,
            level: row.level,
            shift: row.shift,
            courseName: row.courseName,
            division: row.division,
            firstName: row.firstName,
            lastName: row.lastName,
            externalStudentId: row.externalStudentId,
            dni: row.dni,
            rawRowJson,
            status: rowStatus,
            message: rowMessage,
            matchedStudentId: student.id,
            matchedEnrollmentId: enrollmentId,
          },
        });

        return {
          ambiguousDniMatch,
          newStudent,
          yearPresent: Boolean(year),
          enrollmentJustCreated,
          enrollmentReuse,
          rosterOutcome: roster.outcome,
        };
      });

      if (delta.ambiguousDniMatch) duplicateDniMatches += 1;

      if (delta.newStudent) studentsCreated += 1;
      else studentsReused += 1;

      if (delta.yearPresent) {
        if (delta.enrollmentJustCreated) enrollmentsCreated += 1;
        if (delta.enrollmentReuse) enrollmentsReused += 1;
      }

      switch (delta.rosterOutcome) {
        case "created":
          rosterLinksCreated += 1;
          break;
        case "unchanged":
          rosterLinksUnchanged += 1;
          break;
        case "updated":
          rosterLinksUpdated += 1;
          break;
        case "blocked_orders":
          rosterLinksSkippedDueToOrders += 1;
          break;
        case "blocked_manual":
          rosterLinksSkippedManual += 1;
          break;
        case "blocked_has_local_overrides":
          rosterLinksSkippedLocalOverrides += 1;
          break;
        default:
          break;
      }
    } catch (rowErr) {
      errorCount += 1;
      const message = rowErr instanceof Error ? rowErr.message : "Error al procesar fila";
      rowErrors.push({ rowNumber, message });
      await prisma.studentRosterImportRow.create({
        data: {
          batchId: batch.id,
          rowNumber,
          level: row.level || null,
          shift: row.shift || null,
          courseName: row.courseName || null,
          division: row.division || null,
          firstName: row.firstName || null,
          lastName: row.lastName || null,
          externalStudentId: row.externalStudentId,
          dni: row.dni,
          rawRowJson,
          status: RosterImportRowStatus.ERROR,
          message,
        },
      });
    }
  }

  const skippedCount =
    rosterLinksUnchanged +
    rosterLinksSkippedDueToOrders +
    rosterLinksSkippedManual +
    rosterLinksSkippedLocalOverrides;

  await prisma.studentRosterImportBatch.update({
    where: { id: batch.id },
    data: {
      status: RosterImportStatus.APPLIED,
      summaryJson: {
        totalRows: rows.length,
        studentsCreated,
        studentsReused,
        duplicateDniMatches,
        enrollmentsCreated,
        enrollmentsReused,
        rosterLinksCreated,
        rosterLinksUnchanged,
        rosterLinksUpdated,
        rosterLinksSkippedDueToOrders,
        rosterLinksSkippedManual,
        rosterLinksSkippedLocalOverrides,
        errorCount,
        legacyCreatedCount: studentsCreated,
        legacyUpdatedCount: studentsReused,
        legacySkippedCount: skippedCount,
      },
    },
  });

  const summaryCore: ImportStudentRosterSummary = {
    totalRows: rows.length,
    studentsCreated,
    studentsReused,
    duplicateDniMatches,
    enrollmentsCreated,
    enrollmentsReused,
    rosterLinksCreated,
    rosterLinksUnchanged,
    rosterLinksUpdated,
    rosterLinksSkippedDueToOrders,
    rosterLinksSkippedManual,
    rosterLinksSkippedLocalOverrides,
    errorCount,
    rowErrors,
  };

  return {
    batchId: batch.id,
    ...summaryCore,
    createdCount: studentsCreated,
    updatedCount: studentsReused,
    skippedCount,
  };
}
