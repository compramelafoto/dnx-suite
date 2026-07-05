import { MAX_ALBUM_FOLDER_DEPTH_LEVELS } from "@/lib/albums/album-folder-domain";

const MAX_NAME_LEN = 200;
const MAX_PATH_LEN = 2000;

/** Segmentos prohibidos por path traversal o nombres reservados del sistema de archivos. */
const FORBIDDEN_NAME_PATTERNS = [
  /^\.$/,
  /^\.\.$/,
  /^\.+$/,
  /[\\/]/,
  /[\x00-\x1f]/,
  /[<>:"|?*]/,
];

export function normalizeAlbumFolderName(
  raw: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: false, error: "El nombre es requerido." };
  }
  const s = String(raw).trim();
  if (!s) {
    return { ok: false, error: "El nombre es requerido." };
  }
  if (s.length > MAX_NAME_LEN) {
    return { ok: false, error: `El nombre no puede superar ${MAX_NAME_LEN} caracteres.` };
  }
  for (const pattern of FORBIDDEN_NAME_PATTERNS) {
    if (pattern.test(s)) {
      return {
        ok: false,
        error: "Nombre de carpeta inválido: no uses barras, puntos reservados ni caracteres especiales.",
      };
    }
  }
  if (s.includes("..")) {
    return { ok: false, error: "El nombre no puede contener '..'." };
  }
  return { ok: true, value: s };
}

export function buildAlbumFolderPath(parentPath: string | null, name: string): string {
  const segment = name.trim();
  if (!parentPath) return `/${segment}`;
  const base = parentPath.endsWith("/") ? parentPath.slice(0, -1) : parentPath;
  const next = `${base}/${segment}`;
  if (next.length > MAX_PATH_LEN) {
    throw new Error(`La ruta de carpeta supera el límite de ${MAX_PATH_LEN} caracteres.`);
  }
  return next;
}

export function parseSortOrder(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(2_147_483_647, Math.max(-2_147_483_648, Math.trunc(n)));
}

/** Valida segmentos de webkitRelativePath (sin el nombre de archivo). */
export function validateRelativePathSegments(
  segments: string[]
): { ok: true; segments: string[] } | { ok: false; error: string } {
  if (segments.length === 0) {
    return { ok: false, error: "La ruta relativa no contiene carpetas." };
  }
  const normalized: string[] = [];
  for (const seg of segments) {
    const nameRes = normalizeAlbumFolderName(seg);
    if (!nameRes.ok) {
      return { ok: false, error: nameRes.error };
    }
    normalized.push(nameRes.value);
  }
  if (normalized.length > MAX_ALBUM_FOLDER_DEPTH_LEVELS) {
    return {
      ok: false,
      error: `La ruta supera el máximo de ${MAX_ALBUM_FOLDER_DEPTH_LEVELS} niveles de carpeta.`,
    };
  }
  return { ok: true, segments: normalized };
}
