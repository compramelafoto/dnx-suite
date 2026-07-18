import { isClickatonAdminEmail, normalizeEmail } from "@/config/admin/admins";
import {
  sanitizeAdminReturnPath,
  sanitizeClickatonReturnPath,
} from "@/lib/auth/return-path";

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

export { sanitizeAdminReturnPath, sanitizeClickatonReturnPath };
