import type { InstitutionalEnrollmentSyncDb } from "@/lib/school-roster/sync-institutional-album-roster-enrollments";
import { syncAlbumRosterWithInstitutionalEnrollments } from "@/lib/school-roster/sync-institutional-album-roster-enrollments";

export type EnsureAlbumRosterFromEnrollmentsResult = {
  enrollmentsMatched: number;
  rosterCreated: number;
  rosterUpdated: number;
  rosterUnchanged: number;
  blockedOrders: number;
  blockedManual: number;
  blockedLocalOverrides: number;
  markedRemoved?: number;
  markedCourseDrift?: number;
  updatedFull?: number;
  updatedNamesOnly?: number;
};

/**
 * Sincroniza el padrón del álbum con {@link StudentEnrollment} del año y cursos elegidos.
 * Delega en {@link syncAlbumRosterWithInstitutionalEnrollments}: no borra filas, respeta preventa/manual/override local.
 */
export async function ensureAlbumRosterFromEnrollments(
  tx: InstitutionalEnrollmentSyncDb,
  params: {
    albumId: number;
    schoolId: number;
    academicYearId: number;
    selectedCourseKeys: string[];
  }
): Promise<EnsureAlbumRosterFromEnrollmentsResult> {
  const sync = await syncAlbumRosterWithInstitutionalEnrollments(tx, params);

  return {
    enrollmentsMatched: sync.enrollmentsInSelection,
    rosterCreated: sync.added,
    rosterUpdated: sync.updatedFull + sync.updatedNamesOnly,
    rosterUnchanged: sync.unchanged,
    blockedOrders: sync.blockedOrders,
    blockedManual: sync.blockedManual,
    blockedLocalOverrides: sync.blockedLocalOverrides,
    markedRemoved: sync.markedRemoved,
    markedCourseDrift: sync.markedCourseDrift,
    updatedFull: sync.updatedFull,
    updatedNamesOnly: sync.updatedNamesOnly,
  };
}
