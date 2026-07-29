/**
 * Valida un path relativo seguro para redirects post-login (`?next=`).
 * Rechaza URLs absolutas, protocol-relative y esquemas.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  if (value.includes("\\")) return null;
  return value;
}
