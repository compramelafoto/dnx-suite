/**
 * Política centralizada de administradores Clickatón (Etapa 10B / 10B3).
 *
 * Autorización del panel — no confundir con autenticación (`/login`).
 * No repetir esta lista en componentes públicos del header o login.
 *
 * Deuda: migrar a WorkspaceAppAccess / appAccess `CLICKATON`
 * cuando el modelo de identidad unificado esté disponible en schema activo.
 */

/** Administradores iniciales con acceso completo al panel MVP. */
export const CLICKATON_ADMIN_EMAILS = [
  "dnxfotografia@gmail.com",
  "rodrigorincon40@gmail.com",
  "tammyytamer@gmail.com",
  "compramelafoto@gmail.com",
] as const;

export type ClickatonAdminEmail = (typeof CLICKATON_ADMIN_EMAILS)[number];

/** Normaliza email para comparación (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const ADMIN_EMAIL_SET = new Set(
  CLICKATON_ADMIN_EMAILS.map((email) => normalizeEmail(email)),
);

export function isClickatonAdminEmail(email: string): boolean {
  return ADMIN_EMAIL_SET.has(normalizeEmail(email));
}

/** Lista de solo lectura para UI de configuración (misma fuente). */
export function listClickatonAdminEmails(): readonly string[] {
  return CLICKATON_ADMIN_EMAILS;
}
