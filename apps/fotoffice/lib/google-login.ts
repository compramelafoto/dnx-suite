export { attachFotofficeSessionCookieToResponse } from "@/lib/session-cookie";

export const FOTOFFICE_GOOGLE_OAUTH_APP = "fotoffice";

/** Solo paths relativos internos (anti open-redirect). */
export function safeFotofficeNextPath(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value.startsWith("/")) return undefined;
  if (value.startsWith("//")) return undefined;
  if (value.includes("://")) return undefined;
  if (value.includes("\\")) return undefined;
  return value.slice(0, 512);
}
