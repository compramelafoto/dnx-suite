/**
 * Arma la URL de inicio de Google OAuth incluyendo ref de referidos cuando aplica.
 * Usar desde el cliente en páginas de registro/login.
 */

export type BuildGoogleAuthUrlInput = {
  role: string;
  ref?: string | null;
  sourceType?: string | null;
  sourceEntityId?: number | null;
  redirect?: string | null;
};

export function buildGoogleAuthUrl(input: BuildGoogleAuthUrlInput): string {
  const params = new URLSearchParams();
  params.set("role", input.role || "PHOTOGRAPHER");
  const ref = input.ref?.trim();
  if (ref) params.set("ref", ref);
  const sourceType = input.sourceType?.trim();
  if (sourceType) params.set("sourceType", sourceType);
  if (
    typeof input.sourceEntityId === "number" &&
    Number.isFinite(input.sourceEntityId) &&
    input.sourceEntityId > 0
  ) {
    params.set("sourceEntityId", String(input.sourceEntityId));
  }
  const redirect = input.redirect?.trim();
  if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
    params.set("redirect", redirect);
  }
  return `/api/auth/google?${params.toString()}`;
}
