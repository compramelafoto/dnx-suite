import { adminRoutes } from "@/config/admin/navigation";
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import {
  CLICKATON_ACCOUNT_PATH,
  sanitizeClickatonReturnPath,
} from "@/lib/auth/return-path";

/**
 * Destino tras autenticación DNX (Google o email/clave).
 * Auth ≠ autorización: sesión siempre; /admin solo si allowlist.
 */
export function resolveClickatonPostLoginPath(params: {
  email: string;
  globalRole: string;
  next?: string | null;
}): { path: string; adminAuthorized: boolean } {
  const next = sanitizeClickatonReturnPath(params.next, CLICKATON_ACCOUNT_PATH);
  const adminAuthorized = hasClickatonAdminAccess({
    email: params.email,
    globalRole: params.globalRole,
  });

  if (next.startsWith("/admin")) {
    if (!adminAuthorized) {
      return { path: adminRoutes.forbidden, adminAuthorized: false };
    }
    return { path: next, adminAuthorized: true };
  }

  return { path: next, adminAuthorized };
}
