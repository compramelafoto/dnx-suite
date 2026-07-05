export type ReferralSharePath = "/" | "/land" | "/landescolar" | "/Escuelas";

function normalizeReferralPath(path?: string): string {
  if (!path || path.trim() === "") return "/";
  const trimmed = path.trim();
  if (trimmed === "/") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * URL pública de referidos con soporte de landing configurable.
 * Mantener alineado con middleware de cookie clf_ref.
 */
export function getPublicReferralUrl(refCode: string, path: string = "/"): string {
  const raw =
    (typeof process !== "undefined" && process.env.APP_URL) ||
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL) ||
    "https://www.compramelafoto.com";
  const base = String(raw).replace(/\/$/, "");
  const normalizedPath = normalizeReferralPath(path);
  return `${base}${normalizedPath}?ref=${encodeURIComponent(refCode)}`;
}
