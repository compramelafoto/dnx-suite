/** Rol global de plataforma (único con acceso al panel Super Admin). */
const PLATFORM_SUPER_ADMIN_ROLES = new Set(["SUPER_ADMIN"]);

/**
 * Destino tras login en Fotoffice (atajo síncrono).
 * El flujo completo (workspace / onboarding) vive en `resolveFotofficePostLoginDestination`.
 */
export function getFotofficePostLoginPath(role: string): "/admin" | "/workspace" {
  return PLATFORM_SUPER_ADMIN_ROLES.has(role) ? "/admin" : "/workspace";
}

export function resolvePlatformRole(input: { globalRole?: string | null; legacyRole?: string | null }): string {
  return input.globalRole?.trim() || input.legacyRole?.trim() || "USER";
}

export function isFotofficePlatformAdminRole(role: string): boolean {
  return PLATFORM_SUPER_ADMIN_ROLES.has(role);
}

/** Rol interno por workspace a nivel de cuenta global (sin permisos de plataforma). */
export const FOTOFFICE_FUTURE_ROLES = [
  "WORKSPACE_ADMIN",
  "STAFF",
  "TEACHER_MANAGER",
  "COURSE_MANAGER",
] as const;

/**
 * Semántica workspace:
 * - MembershipRole.ADMIN => OWNER/WORKSPACE_OWNER (dueño del workspace)
 * - MembershipRole.MEMBER => STAFF interno del workspace
 */
export function getWorkspaceMembershipLabel(role: "ADMIN" | "MEMBER"): "OWNER" | "STAFF" {
  return role === "ADMIN" ? "OWNER" : "STAFF";
}
