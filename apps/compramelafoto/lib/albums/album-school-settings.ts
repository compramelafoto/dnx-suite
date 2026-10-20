/**
 * Configuración escolar de un álbum: escuela vinculada, modo, identificación de
 * alumnos y comisión del organizador.
 *
 * `buildAlbumSchoolSettingsUpdateData` es el mismo código que tenía el PATCH de
 * `app/api/dashboard/albums/[id]/route.ts` para esos campos, movido sin cambios:
 * mismo orden de validaciones, mismos textos de error y mismos códigos. La ruta lo
 * sigue usando y `updateAlbumSchoolSettingsForOwner` lo usa para DNX Bot.
 *
 * Vincular una escuela NO sincroniza el padrón de alumnos (igual que el panel).
 */
import { prisma } from "@/lib/prisma";
import type {
  AlbumMode,
  StudentIdentificationMode,
  OrganizerCommissionAppliesTo,
} from "@/lib/prisma";

export type AlbumSchoolPatch = {
  mode?: "SIMPLE" | "EVENT" | "SCHOOL" | "COLLABORATIVE";
  schoolId?: number | null;
  studentIdentificationMode?: "NONE" | "MANUAL" | "ROSTER_OPTIONAL" | "ROSTER_REQUIRED" | null;
  allowManualStudentFallback?: boolean;
  organizerCommissionEnabled?: boolean;
  organizerCommissionPercentage?: number | null;
  organizerCommissionAppliesTo?: Array<"PREVENTA" | "POST_EVENT" | "EXTRAS">;
};

export type AlbumSchoolSettingsBuildResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: 400; error: string };

/**
 * Arma los datos a guardar para los campos escolares. Recibe el cuerpo tal como
 * llega (tipos crudos) y lo trata exactamente igual que el PATCH del panel.
 * Una escuela ajena o inexistente → 400 «Escuela no encontrada o no te pertenece».
 */
export async function buildAlbumSchoolSettingsUpdateData(
  patch: Record<string, unknown>,
  actorUserId: number
): Promise<AlbumSchoolSettingsBuildResult> {
  // El cuerpo del PATCH no viene tipado: se lee crudo para conservar el comportamiento.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = patch as Record<string, any>;
  const {
    schoolId,
    mode,
    studentIdentificationMode,
    allowManualStudentFallback,
    organizerCommissionEnabled,
    organizerCommissionPercentage,
    organizerCommissionAppliesTo,
  } = raw;

  const data: Record<string, unknown> = {};

  if (schoolId !== undefined) {
    const sid = schoolId == null || schoolId === "" ? null : (Number.isFinite(Number(schoolId)) ? Number(schoolId) : null);
    if (sid != null) {
      const school = await prisma.school.findUnique({ where: { id: sid }, select: { ownerId: true } });
      if (!school || school.ownerId !== actorUserId) {
        return { ok: false, status: 400, error: "Escuela no encontrada o no te pertenece" };
      }
    }
    data.schoolId = sid;
  }
  if (mode !== undefined) {
    const validModes: AlbumMode[] = ["SIMPLE", "EVENT", "SCHOOL", "COLLABORATIVE"];
    if (typeof mode !== "string" || !validModes.includes(mode as AlbumMode)) {
      return { ok: false, status: 400, error: "mode inválido" };
    }
    data.mode = mode as AlbumMode;
  }

  if (studentIdentificationMode !== undefined) {
    const allowed: StudentIdentificationMode[] = [
      "NONE",
      "MANUAL",
      "ROSTER_OPTIONAL",
      "ROSTER_REQUIRED",
    ];
    if (studentIdentificationMode === null || studentIdentificationMode === "") {
      data.studentIdentificationMode = null;
    } else if (
      typeof studentIdentificationMode === "string" &&
      allowed.includes(studentIdentificationMode as StudentIdentificationMode)
    ) {
      data.studentIdentificationMode = studentIdentificationMode as StudentIdentificationMode;
    } else {
      return {
        ok: false,
        status: 400,
        error: "studentIdentificationMode inválido (NONE, MANUAL, ROSTER_OPTIONAL, ROSTER_REQUIRED o vacío)",
      };
    }
  }
  if (allowManualStudentFallback !== undefined) {
    data.allowManualStudentFallback = Boolean(allowManualStudentFallback);
  }
  if (organizerCommissionEnabled !== undefined) {
    data.organizerCommissionEnabled = Boolean(organizerCommissionEnabled);
  }
  if (organizerCommissionPercentage !== undefined) {
    if (
      organizerCommissionPercentage === null ||
      organizerCommissionPercentage === ""
    ) {
      data.organizerCommissionPercentage = null;
    } else {
      const value = Number(organizerCommissionPercentage);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return { ok: false, status: 400, error: "organizerCommissionPercentage inválido (0-100)" };
      }
      data.organizerCommissionPercentage = value;
    }
  }
  if (organizerCommissionAppliesTo !== undefined) {
    const allowed: OrganizerCommissionAppliesTo[] = ["PREVENTA", "POST_EVENT", "EXTRAS"];
    if (!Array.isArray(organizerCommissionAppliesTo)) {
      return { ok: false, status: 400, error: "organizerCommissionAppliesTo debe ser un array" };
    }
    const parsed = organizerCommissionAppliesTo
      .map((entry) => String(entry))
      .filter((entry): entry is OrganizerCommissionAppliesTo =>
        allowed.includes(entry as OrganizerCommissionAppliesTo)
      );
    data.organizerCommissionAppliesTo = parsed;
  }

  return { ok: true, data };
}

const ALBUM_SCHOOL_SETTINGS_SELECT = {
  id: true,
  userId: true,
  deletedAt: true,
  mode: true,
  schoolId: true,
  studentIdentificationMode: true,
  allowManualStudentFallback: true,
  organizerCommissionEnabled: true,
  organizerCommissionPercentage: true,
  organizerCommissionAppliesTo: true,
} as const;

const NOT_FOUND = { ok: false as const, status: 404 as const, error: "Álbum no encontrado" };

/**
 * Edita la configuración escolar de un álbum en nombre de su dueño (DNX Bot). Un
 * álbum ajeno o borrado responde igual que uno inexistente (404) para no revelar
 * que existe. `before`/`after` sólo incluyen las claves que se escribieron, con
 * valores simples (números, textos, booleanos, listas de textos o null): pasados
 * por JSON siguen sirviendo como `patch` para deshacer.
 */
export async function updateAlbumSchoolSettingsForOwner(p: {
  actorUserId: number;
  albumId: number;
  patch: AlbumSchoolPatch;
}): Promise<
  | { ok: true; before: Record<string, unknown>; after: Record<string, unknown> }
  | { ok: false; status: 400 | 404; error: string }
> {
  const album = await prisma.album.findUnique({
    where: { id: p.albumId },
    select: ALBUM_SCHOOL_SETTINGS_SELECT,
  });
  if (!album || album.deletedAt) return NOT_FOUND;
  if (album.userId !== p.actorUserId) return NOT_FOUND;

  const built = await buildAlbumSchoolSettingsUpdateData(
    p.patch as Record<string, unknown>,
    p.actorUserId
  );
  if (!built.ok) return built;

  const keys = Object.keys(built.data);
  if (keys.length === 0) {
    return { ok: false, status: 400, error: "No hay cambios para aplicar" };
  }

  const albumRow = album as unknown as Record<string, unknown>;
  const before = Object.fromEntries(keys.map((k) => [k, albumRow[k]]));
  const updated = await prisma.album.update({
    where: { id: p.albumId },
    data: built.data,
    select: ALBUM_SCHOOL_SETTINGS_SELECT,
  });
  const updatedRow = updated as unknown as Record<string, unknown>;
  const after = Object.fromEntries(keys.map((k) => [k, updatedRow[k]]));
  return { ok: true, before, after };
}
