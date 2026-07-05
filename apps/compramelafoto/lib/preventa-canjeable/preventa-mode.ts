import { StudentIdentificationMode } from "@/lib/prisma";

export type PreventaMode = "STANDARD" | "SCHOOL";

export type PreventaAlbumMeta = {
  schoolId: number | null;
  /** Viene del JSON público; se normaliza a enum. */
  studentIdentificationMode?: string | null;
  allowManualStudentFallback?: boolean | null;
};

export type PreventaRequirements = {
  requiresSchoolData: boolean;
};

/** Cómo mostrar identificación de alumno en preventa pública (solo escolar). */
export type PublicStudentIdentificationPlan = {
  /** true si hay escuela y el modo no es NONE (hay UI extra de alumno). */
  usesStudentIdentification: boolean;
  /** Modo efectivo; null/undefined se trata como NONE. */
  mode: StudentIdentificationMode;
  allowManualStudentFallback: boolean;
  showRosterSearch: boolean;
  /** Solo formulario manual (sin listado de padrón). */
  manualOnly: boolean;
  /** Exige fila del padrón salvo fallback manual permitido. */
  rosterEffectivelyRequired: boolean;
};

function normalizeIdentMode(raw: string | null | undefined): StudentIdentificationMode {
  if (raw == null || raw === "") return StudentIdentificationMode.NONE;
  const v = String(raw).trim();
  const allowed = new Set<string>(Object.values(StudentIdentificationMode));
  if (allowed.has(v)) return v as StudentIdentificationMode;
  return StudentIdentificationMode.NONE;
}

/**
 * Reglas de UI para la preventa pública cuando el álbum es escolar.
 */
export function getPublicStudentIdentificationPlan(
  album: PreventaAlbumMeta | null | undefined
): PublicStudentIdentificationPlan {
  if (!isSchoolAlbum(album)) {
    return {
      usesStudentIdentification: false,
      mode: StudentIdentificationMode.NONE,
      allowManualStudentFallback: false,
      showRosterSearch: false,
      manualOnly: false,
      rosterEffectivelyRequired: false,
    };
  }
  const mode = normalizeIdentMode(album?.studentIdentificationMode ?? undefined);
  const allowManualStudentFallback = Boolean(album?.allowManualStudentFallback);
  const usesStudentIdentification = mode !== StudentIdentificationMode.NONE;
  const showRosterSearch =
    mode === StudentIdentificationMode.ROSTER_OPTIONAL ||
    mode === StudentIdentificationMode.ROSTER_REQUIRED;
  const manualOnly = mode === StudentIdentificationMode.MANUAL;
  const rosterEffectivelyRequired =
    mode === StudentIdentificationMode.ROSTER_REQUIRED && !allowManualStudentFallback;

  return {
    usesStudentIdentification,
    mode,
    allowManualStudentFallback,
    showRosterSearch,
    manualOnly,
    rosterEffectivelyRequired,
  };
}

/**
 * Regla única: SCHOOL cuando album.schoolId != null
 */
export function isSchoolAlbum(album: PreventaAlbumMeta | null | undefined): boolean {
  return Boolean(album?.schoolId);
}

export function getPreventaMode(album: PreventaAlbumMeta | null | undefined): PreventaMode {
  return isSchoolAlbum(album) ? "SCHOOL" : "STANDARD";
}

export function getPreventaRequirements(
  album: PreventaAlbumMeta | null | undefined
): PreventaRequirements {
  const school = isSchoolAlbum(album);
  return {
    requiresSchoolData: school,
  };
}
