import { isClickatonAdminEmail, normalizeEmail } from "@/config/admin/admins";
import { adminRoutes } from "@/config/admin/navigation";

export type ClickatonAccessSubject = {
  email: string;
  globalRole: string;
};

/**
 * Punto único de decisión: ¿puede administrar el panel Clickatón?
 *
 * - SUPER_ADMIN de DNX Identity
 * - email (normalizado) en la lista centralizada de administradores iniciales
 *
 * Deuda: migrar a appAccess `CLICKATON` cuando WorkspaceAppAccess vuelva al schema activo.
 */
export function hasClickatonAdminAccess(user: ClickatonAccessSubject | null): boolean {
  if (!user) return false;
  if (user.globalRole === "SUPER_ADMIN") return true;
  return isClickatonAdminEmail(normalizeEmail(user.email));
}

/** Destino post-login seguro: solo rutas bajo /admin (excepto login). */
export function sanitizeAdminReturnPath(raw: string | null | undefined): string {
  if (!raw) return adminRoutes.dashboard;
  const value = raw.trim();
  if (!value.startsWith("/admin")) return adminRoutes.dashboard;
  if (value.startsWith("//")) return adminRoutes.dashboard;
  if (value.includes("://")) return adminRoutes.dashboard;
  if (value.startsWith(adminRoutes.login)) return adminRoutes.dashboard;
  return value;
}
