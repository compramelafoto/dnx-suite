import path from "node:path";
import {
  VISUAL_REFERENCE_ALLOWED_EXTENSIONS,
  VISUAL_REFERENCES_ASSETS_DIR,
} from "../catalog/paths.js";

export type ResolvedAssetPath =
  | { ok: true; absolutePath: string; relativePath: string; ext: string }
  | { ok: false; reason: "TRAVERSAL" | "OUTSIDE" | "INVALID_EXT" | "EMPTY" };

/**
 * Resuelve una ruta relativa de imagen dentro de `.local/visual-references/assets/`.
 * Rechaza traversal y rutas absolutas.
 */
export function resolveAllowedAssetPath(imagePath: string): ResolvedAssetPath {
  if (!imagePath || typeof imagePath !== "string" || !imagePath.trim()) {
    return { ok: false, reason: "EMPTY" };
  }
  const trimmed = imagePath.trim();
  if (
    trimmed.includes("\0") ||
    trimmed.includes("..") ||
    path.isAbsolute(trimmed) ||
    trimmed.startsWith("~") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
  ) {
    return { ok: false, reason: "TRAVERSAL" };
  }

  const normalized = path.normalize(trimmed).replace(/^(\.\/)+/, "");
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return { ok: false, reason: "TRAVERSAL" };
  }

  const absolutePath = path.resolve(VISUAL_REFERENCES_ASSETS_DIR, normalized);
  const assetsRoot = path.resolve(VISUAL_REFERENCES_ASSETS_DIR);
  if (
    absolutePath !== assetsRoot &&
    !absolutePath.startsWith(assetsRoot + path.sep)
  ) {
    return { ok: false, reason: "OUTSIDE" };
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (
    !(VISUAL_REFERENCE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
  ) {
    return { ok: false, reason: "INVALID_EXT" };
  }

  return { ok: true, absolutePath, relativePath: normalized, ext };
}
