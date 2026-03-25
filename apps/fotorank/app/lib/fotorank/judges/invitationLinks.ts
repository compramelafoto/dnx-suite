/**
 * Construye la URL pública de registro con token (solo http/https en producción).
 * Configurar NEXT_PUBLIC_APP_URL o NEXT_PUBLIC_FOTORANK_URL para enlaces absolutos (email, copiar fuera del mismo host).
 */
export function hasAbsoluteFotorankPublicBaseUrl(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() || "";
  return raw.startsWith("http://") || raw.startsWith("https://");
}

/**
 * En producción, enlaces relativos rompen emails / copiar URL. No lanza: solo aviso explícito para operación.
 */
export function logInvitationBaseUrlMisconfigurationIfNeeded(context: string): void {
  if (process.env.NODE_ENV !== "production") return;
  if (hasAbsoluteFotorankPublicBaseUrl()) return;
  console.warn(
    `[fotorank] ${context}: definí NEXT_PUBLIC_APP_URL o NEXT_PUBLIC_FOTORANK_URL con URL absoluta (https) para enlaces de invitación válidos fuera del mismo host.`,
  );
}

export function buildJudgeInvitationRegistrationUrl(plainToken: string): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() ||
    "";
  const base = raw.replace(/\/+$/, "");
  const path = `/jurado/registro?token=${encodeURIComponent(plainToken)}`;
  if (base) {
    return `${base}${path}`;
  }
  return path;
}
