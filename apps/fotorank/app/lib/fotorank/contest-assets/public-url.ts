const CONTEST_ASSETS_PUBLIC_PREFIX = "/contest-assets";

/** Extensiones admitidas para assets de concurso (sin SVG). */
export const CONTEST_ASSET_ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

export function contestAssetsPublicRoot(slug: string): string {
  const s = slug.trim().replace(/^\/+|\/+$/g, "");
  return `${CONTEST_ASSETS_PUBLIC_PREFIX}/${s}`;
}

/**
 * URL pública canónica. No valida existencia en disco.
 * `relativePath` sin leading slash, relativa al slug.
 */
export function contestAssetPublicUrl(slug: string, relativePath: string): string {
  const clean = relativePath.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  return `${contestAssetsPublicRoot(slug)}/${clean}`;
}

export function isAllowedContestAssetExtension(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  return CONTEST_ASSET_ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Normaliza y rechaza path traversal. */
export function sanitizeContestAssetRelativePath(relativePath: string): string | null {
  const clean = relativePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || clean.startsWith("/") || clean.includes("//")) {
    return null;
  }
  if (!isAllowedContestAssetExtension(clean)) return null;
  return clean;
}
