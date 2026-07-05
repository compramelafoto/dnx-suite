import {
  StudentEnrollmentStatus,
  StudentSourceType,
  type AlbumStudentRosterEntry,
  type PrismaClient,
} from "@/lib/prisma";
import { encodeCourseSlotKey } from "@/lib/school-roster/course-slot-key";
import { normalizePersonNamePart } from "@/lib/school-roster/student-normalize";

/** Subconjunto suficiente para sync/preview institucional (cliente normal o cliente de `$transaction`). */
export type InstitutionalEnrollmentSyncDb = Pick<
  PrismaClient,
  "studentEnrollment" | "albumStudentRosterEntry" | "preCompraOrder"
>;

export const INSTITUTIONAL_STALE_REMOVED = "REMOVED_FROM_SELECTION" as const;
export const INSTITUTIONAL_STALE_COURSE = "COURSE_CHANGED" as const;

export function isInstitutionalSyncSubject(
  row: Pick<AlbumStudentRosterEntry, "sourceType" | "enrollmentId" | "syncSourceEnrollmentId">
): boolean {
  return (
    row.sourceType === StudentSourceType.SCHOOL_ENROLLMENT_SYNC ||
    row.enrollmentId != null ||
    row.syncSourceEnrollmentId != null
  );
}

export type SyncAlbumRosterWithInstitutionalEnrollmentsResult = {
  enrollmentsInSelection: number;
  rosterEntriesConsidered: number;
  added: number;
  updatedFull: number;
  updatedNamesOnly: number;
  markedRemoved: number;
  markedCourseDrift: number;
  unchanged: number;
  blockedOrders: number;
  blockedManual: number;
  blockedLocalOverrides: number;
};

type EnrollmentRow = {
  id: number;
  studentId: number;
  level: string;
  shift: string;
  courseName: string;
  division: string;
  student: { firstName: string; lastName: string };
};

function rosterProtectionTierFromOrderMap(
  row: AlbumStudentRosterEntry,
  orderCountByRosterEntry: Map<number, number>
): "ok" | "orders" | "manual" | "local_overrides" {
  if (row.isManual) return "manual";
  if (row.hasLocalOverrides) return "local_overrides";
  const c = orderCountByRosterEntry.get(row.id) ?? 0;
  return c > 0 ? "orders" : "ok";
}

async function loadOrderCountByRosterEntry(
  tx: InstitutionalEnrollmentSyncDb,
  rosterEntryIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const ids = rosterEntryIds.filter((id) => id > 0);
  if (ids.length === 0) return map;
  const grouped = await tx.preCompraOrder.groupBy({
    by: ["albumRosterEntryId"],
    where: { albumRosterEntryId: { in: ids } },
    _count: { _all: true },
  });
  for (const g of grouped) {
    if (g.albumRosterEntryId != null) {
      map.set(g.albumRosterEntryId, g._count._all);
    }
  }
  return map;
}

/**
 * Sincronización institucional inteligente: vistas del padrón del álbum alineadas a {@link StudentEnrollment}
 * dentro de los cursos/año configurados en el álbum.
 *
 * No elimina {@link AlbumStudentRosterEntry}. Respeta pedidos preventa y entradas manuales / con override local.
 * Congela curso/división histórico si cambió la matrícula (marca advertencia).
 */
export async function syncAlbumRosterWithInstitutionalEnrollments(
  tx: InstitutionalEnrollmentSyncDb,
  params: {
    albumId: number;
    schoolId: number;
    academicYearId: number;
    selectedCourseKeys: string[];
  }
): Promise<SyncAlbumRosterWithInstitutionalEnrollmentsResult> {
  const out: SyncAlbumRosterWithInstitutionalEnrollmentsResult = {
    enrollmentsInSelection: 0,
    rosterEntriesConsidered: 0,
    added: 0,
    updatedFull: 0,
    updatedNamesOnly: 0,
    markedRemoved: 0,
    markedCourseDrift: 0,
    unchanged: 0,
    blockedOrders: 0,
    blockedManual: 0,
    blockedLocalOverrides: 0,
  };

  if (params.selectedCourseKeys.length === 0) return out;

  const keySet = new Set(params.selectedCourseKeys);
  const now = new Date();

  const enrollmentRows = await tx.studentEnrollment.findMany({
    where: {
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      status: StudentEnrollmentStatus.ACTIVE,
    },
    include: { student: { select: { firstName: true, lastName: true } } },
  });

  const enrollmentByStudent = new Map<number, EnrollmentRow>();
  for (const e of enrollmentRows) {
    const sk = encodeCourseSlotKey(e.level, e.shift, e.courseName, e.division);
    if (!keySet.has(sk)) continue;
    enrollmentByStudent.set(e.studentId, {
      id: e.id,
      studentId: e.studentId,
      level: e.level,
      shift: e.shift,
      courseName: e.courseName,
      division: e.division,
      student: e.student,
    });
    out.enrollmentsInSelection += 1;
  }

  const rosterStudentsInAlbum = await tx.albumStudentRosterEntry.findMany({
    where: { albumId: params.albumId },
    select: { studentId: true },
  });
  const studentIdsAlreadyOnAlbum = new Set(rosterStudentsInAlbum.map((r) => r.studentId));

  // 1) Matrícula en selección sin fila de padrón → alta
  for (const E of enrollmentByStudent.values()) {
    if (studentIdsAlreadyOnAlbum.has(E.studentId)) continue;

    const fn = normalizePersonNamePart(E.student.firstName);
    const ln = normalizePersonNamePart(E.student.lastName);
    await tx.albumStudentRosterEntry.create({
      data: {
        albumId: params.albumId,
        schoolId: params.schoolId,
        studentId: E.studentId,
        enrollmentId: E.id,
        syncSourceEnrollmentId: E.id,
        level: E.level.trim(),
        shift: E.shift.trim(),
        courseName: E.courseName.trim(),
        division: E.division.trim(),
        snapshotFirstName: fn,
        snapshotLastName: ln,
        sourceType: StudentSourceType.SCHOOL_ENROLLMENT_SYNC,
        isManual: false,
        isActive: true,
        lastEnrollmentSyncAt: now,
        isOutdatedFromEnrollment: false,
        institutionalStaleReason: null,
        hasLocalOverrides: false,
      },
    });
    studentIdsAlreadyOnAlbum.add(E.studentId);
    out.added += 1;
  }

  const rosterRows = await tx.albumStudentRosterEntry.findMany({
    where: { albumId: params.albumId, isActive: true },
  });

  const orderCountByEntry = await loadOrderCountByRosterEntry(
    tx,
    rosterRows.map((r) => r.id)
  );

  for (const R of rosterRows) {
    if (!isInstitutionalSyncSubject(R)) continue;
    out.rosterEntriesConsidered += 1;

    const E = enrollmentByStudent.get(R.studentId);
    const tier = rosterProtectionTierFromOrderMap(R, orderCountByEntry);

    if (!E) {
      if (R.isOutdatedFromEnrollment && R.institutionalStaleReason === INSTITUTIONAL_STALE_REMOVED) {
        out.unchanged += 1;
        continue;
      }
      await tx.albumStudentRosterEntry.update({
        where: { id: R.id },
        data: {
          isOutdatedFromEnrollment: true,
          institutionalStaleReason: INSTITUTIONAL_STALE_REMOVED,
        },
      });
      out.markedRemoved += 1;
      continue;
    }

    const eSlot = encodeCourseSlotKey(E.level, E.shift, E.courseName, E.division);
    const rSlot = encodeCourseSlotKey(R.level, R.shift, R.courseName, R.division);
    const slotMatches = eSlot === rSlot;

    const fn = normalizePersonNamePart(E.student.firstName);
    const ln = normalizePersonNamePart(E.student.lastName);
    const namesMatch = R.snapshotFirstName.trim() === fn && R.snapshotLastName.trim() === ln;

    if (tier !== "ok") {
      if (tier === "orders") out.blockedOrders += 1;
      else if (tier === "manual") out.blockedManual += 1;
      else out.blockedLocalOverrides += 1;

      if (!slotMatches) {
        await tx.albumStudentRosterEntry.update({
          where: { id: R.id },
          data: {
            isOutdatedFromEnrollment: true,
            institutionalStaleReason: INSTITUTIONAL_STALE_COURSE,
            syncSourceEnrollmentId: E.id,
          },
        });
        out.markedCourseDrift += 1;
      } else {
        out.unchanged += 1;
      }
      continue;
    }

    if (slotMatches) {
      const already =
        namesMatch &&
        R.enrollmentId === E.id &&
        !R.isOutdatedFromEnrollment &&
        R.institutionalStaleReason == null;
      if (already) {
        out.unchanged += 1;
        continue;
      }
      await tx.albumStudentRosterEntry.update({
        where: { id: R.id },
        data: {
          level: E.level.trim(),
          shift: E.shift.trim(),
          courseName: E.courseName.trim(),
          division: E.division.trim(),
          snapshotFirstName: fn,
          snapshotLastName: ln,
          enrollmentId: E.id,
          syncSourceEnrollmentId: E.id,
          sourceType: StudentSourceType.SCHOOL_ENROLLMENT_SYNC,
          lastEnrollmentSyncAt: now,
          isOutdatedFromEnrollment: false,
          institutionalStaleReason: null,
        },
      });
      out.updatedFull += 1;
      continue;
    }

    // Curso institucional ≠ snapshot operativo → no pisar nivel/curso automáticamente
    await tx.albumStudentRosterEntry.update({
      where: { id: R.id },
      data: {
        snapshotFirstName: fn,
        snapshotLastName: ln,
        enrollmentId: E.id,
        syncSourceEnrollmentId: E.id,
        lastEnrollmentSyncAt: now,
        isOutdatedFromEnrollment: true,
        institutionalStaleReason: INSTITUTIONAL_STALE_COURSE,
        sourceType: StudentSourceType.SCHOOL_ENROLLMENT_SYNC,
      },
    });
    out.updatedNamesOnly += 1;
    out.markedCourseDrift += 1;
  }

  return out;
}

export type InstitutionalRosterPreviewStatus =
  | "sincronizado"
  | "pendiente_actualizacion"
  | "desactualizado_removido"
  | "desactualizado_curso"
  | "protegido_pedidos"
  | "protegido_manual"
  | "protegido_override"
  | "nuevo";

export type InstitutionalRosterPreviewRow =
  | {
      kind: "roster_row";
      rosterEntryId: number;
      studentId: number;
      displayName: string;
      institutionalSlotLabel?: string | null;
      rosterSlotLabel?: string | null;
      status: Exclude<InstitutionalRosterPreviewStatus, "nuevo">;
      recommendedAction: string;
      badges: string[];
      staleReason?: string | null;
    }
  | {
      kind: "new_enrollment";
      enrollmentId: number;
      studentId: number;
      displayName: string;
      institutionalSlotLabel: string;
      status: "nuevo";
      recommendedAction: string;
      badges: string[];
    };

export type PreviewInstitutionalAlbumRosterSyncResult = {
  counts: {
    sincronizados: number;
    pendienteActualizacion: number;
    nuevos: number;
    desactualizados: number;
    protegidosPedidos: number;
    protegidosManual: number;
    protegidosOverride: number;
    consideradosInstitucionales: number;
  };
  rows: InstitutionalRosterPreviewRow[];
};

/** Vista previa read-only para UI (tab Escuela → diferencias): no escribe BD. */
export async function previewInstitutionalAlbumRosterSync(
  tx: InstitutionalEnrollmentSyncDb,
  params: {
    albumId: number;
    schoolId: number;
    academicYearId: number;
    selectedCourseKeys: string[];
  }
): Promise<PreviewInstitutionalAlbumRosterSyncResult> {
  const emptyCounts = (): PreviewInstitutionalAlbumRosterSyncResult["counts"] => ({
    sincronizados: 0,
    pendienteActualizacion: 0,
    nuevos: 0,
    desactualizados: 0,
    protegidosPedidos: 0,
    protegidosManual: 0,
    protegidosOverride: 0,
    consideradosInstitucionales: 0,
  });

  const out: PreviewInstitutionalAlbumRosterSyncResult = {
    counts: emptyCounts(),
    rows: [],
  };

  if (params.selectedCourseKeys.length === 0) return out;

  const keySet = new Set(params.selectedCourseKeys);

  const enrollmentRows = await tx.studentEnrollment.findMany({
    where: {
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      status: StudentEnrollmentStatus.ACTIVE,
    },
    include: { student: { select: { firstName: true, lastName: true } } },
  });

  const enrollmentByStudent = new Map<number, EnrollmentRow>();
  for (const e of enrollmentRows) {
    const sk = encodeCourseSlotKey(e.level, e.shift, e.courseName, e.division);
    if (!keySet.has(sk)) continue;
    enrollmentByStudent.set(e.studentId, {
      id: e.id,
      studentId: e.studentId,
      level: e.level,
      shift: e.shift,
      courseName: e.courseName,
      division: e.division,
      student: e.student,
    });
  }

  function slotLabel(er: EnrollmentRow): string {
    return [er.level, er.shift, er.courseName, er.division]
      .map((s) => String(s ?? "").trim())
      .filter(Boolean)
      .join(" · ");
  }

  function rosterSlotFromRow(ro: AlbumStudentRosterEntry): string {
    return [ro.level, ro.shift, ro.courseName, ro.division]
      .map((s) => String(s ?? "").trim())
      .filter(Boolean)
      .join(" · ");
  }

  const rosterRows = await tx.albumStudentRosterEntry.findMany({
    where: { albumId: params.albumId, isActive: true },
  });
  const studentsOnAlbum = new Set(rosterRows.map((r) => r.studentId));
  const orderCountByEntry = await loadOrderCountByRosterEntry(
    tx,
    rosterRows.map((r) => r.id)
  );

  const bumpProtect = (tier: "orders" | "manual" | "local_overrides") => {
    if (tier === "orders") out.counts.protegidosPedidos += 1;
    else if (tier === "manual") out.counts.protegidosManual += 1;
    else out.counts.protegidosOverride += 1;
  };

  const badgeForProtected = (
    tier: "orders" | "manual" | "local_overrides"
  ): {
    status: Exclude<InstitutionalRosterPreviewStatus, "nuevo">;
    badges: string[];
  } => {
    if (tier === "orders") {
      return {
        status: "protegido_pedidos",
        badges: ["protegido", "preventa"],
      };
    }
    if (tier === "manual") {
      return {
        status: "protegido_manual",
        badges: ["protegido", "manual"],
      };
    }
    return {
      status: "protegido_override",
      badges: ["protegido", "override local"],
    };
  };

  for (const E of enrollmentByStudent.values()) {
    if (studentsOnAlbum.has(E.studentId)) continue;

    const fn = normalizePersonNamePart(E.student.firstName);
    const ln = normalizePersonNamePart(E.student.lastName);

    const displayName = `${ln}, ${fn}`;
    const institutionalSlotLabel = slotLabel(E);
    out.rows.push({
      kind: "new_enrollment",
      enrollmentId: E.id,
      studentId: E.studentId,
      displayName,
      institutionalSlotLabel,
      status: "nuevo",
      recommendedAction: "Ejecutar «Sincronizar ahora» para agregar esta fila al padrón del álbum.",
      badges: ["nuevo"],
    });
    out.counts.nuevos += 1;
  }

  const pushRosterPreview = (
    R: AlbumStudentRosterEntry,
    E: EnrollmentRow | undefined,
    spec: Omit<Extract<InstitutionalRosterPreviewRow, { kind: "roster_row" }>, "kind" | "rosterEntryId" | "studentId" | "displayName">
  ) => {
    const fn = normalizePersonNamePart(R.snapshotFirstName);
    const ln = normalizePersonNamePart(R.snapshotLastName);
    out.rows.push({
      kind: "roster_row",
      rosterEntryId: R.id,
      studentId: R.studentId,
      displayName: `${ln}, ${fn}`,
      institutionalSlotLabel: E ? slotLabel(E) : null,
      rosterSlotLabel: rosterSlotFromRow(R),
      ...spec,
    });
  };

  for (const R of rosterRows) {
    if (!isInstitutionalSyncSubject(R)) continue;

    const E = enrollmentByStudent.get(R.studentId);

    const fn = normalizePersonNamePart(E?.student.firstName ?? "");
    const ln = normalizePersonNamePart(E?.student.lastName ?? "");
    const eSlot =
      E != null ? encodeCourseSlotKey(E.level, E.shift, E.courseName, E.division) : "";
    const rSlot = encodeCourseSlotKey(R.level, R.shift, R.courseName, R.division);
    const slotMatches = E != null && eSlot === rSlot;

    const tier = rosterProtectionTierFromOrderMap(R, orderCountByEntry);
    const alreadySynced =
      E != null &&
      slotMatches &&
      R.snapshotFirstName.trim() === fn &&
      R.snapshotLastName.trim() === ln &&
      R.enrollmentId === E.id &&
      !R.isOutdatedFromEnrollment &&
      R.institutionalStaleReason == null;

    if (alreadySynced) {
      out.counts.consideradosInstitucionales += 1;
      out.counts.sincronizados += 1;
      pushRosterPreview(R, E, {
        status: "sincronizado",
        recommendedAction: "Sin acción necesaria.",
        badges: ["sincronizado"],
        staleReason: R.institutionalStaleReason ?? null,
      });
      continue;
    }

    out.counts.consideradosInstitucionales += 1;

    if (!E) {
      out.counts.desactualizados += 1;
      pushRosterPreview(R, undefined, {
        status: "desactualizado_removido",
        recommendedAction:
          "Ya no aparece en los cursos vinculados al álbum (otro ciclo o curso institucional). La fila del álbum no se borra; podés revisar en la institución o dejar marcada.",
        badges: ["desactualizado"],
        staleReason: R.institutionalStaleReason ?? INSTITUTIONAL_STALE_REMOVED,
      });
      continue;
    }

    if (tier !== "ok") {
      bumpProtect(tier);
      const bp = badgeForProtected(tier);
      if (!slotMatches) {
        out.counts.desactualizados += 1;
      }
      const action =
        !slotMatches
          ? tier === "orders"
            ? "Hay pedidos preventa: no actualizamos el snapshot desde la institución. El curso del álbum y el actual de matrícula no coinciden; revisión manual."
            : tier === "manual"
              ? "Entrada manual: no mover curso/desde padrón. La institución tiene otro curso/división; ajustá a mano si corresponde."
              : "Override local: no pisar desde sync; el curso institucional difiere del del álbum — revisión manual."
          : tier === "orders"
            ? "Hay cambios institucionales (nombre/matricula) pero esta fila tiene pedidos preventa: sin actualización automática."
            : tier === "manual"
              ? "Cambió datos en institución pero la entrada es manual: no pisar desde sync."
              : "Override local preservado (`hasLocalOverrides`): no pisar desde sync aunque el padrón escolar cambie.";
      pushRosterPreview(R, E, {
        status: bp.status,
        badges: bp.badges,
        recommendedAction: action,
        staleReason: !slotMatches ? INSTITUTIONAL_STALE_COURSE : (R.institutionalStaleReason ?? null),
      });
      continue;
    }

    /* tier ok: el sync institucional puede escribir (con reglas ya implementadas). */
    if (!slotMatches) {
      out.counts.desactualizados += 1;
      out.counts.pendienteActualizacion += 1;
      pushRosterPreview(R, E, {
        status: "desactualizado_curso",
        recommendedAction:
          "La institución tiene otro curso/división que el snapshot del álbum. «Sincronizar ahora» alinea nombre y referencia de matrícula pero no mueve nivel/curso automáticamente en el álbum.",
        badges: ["desactualizado"],
        staleReason: INSTITUTIONAL_STALE_COURSE,
      });
      continue;
    }

    out.counts.pendienteActualizacion += 1;
    pushRosterPreview(R, E, {
      status: "pendiente_actualizacion",
      recommendedAction:
        "«Sincronizar ahora» actualizará nombres, matrícula y curso porque coinciden con la institución y no hay restricciones.",
      badges: ["pendiente sync"],
      staleReason: R.institutionalStaleReason,
    });
  }

  return out;
}

