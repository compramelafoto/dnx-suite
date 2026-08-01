/**
 * Destino post-login único para ComprameLaFoto (paridad legacy).
 * No inventar rutas: solo landings conocidas del monorepo / legacy.
 */

export type ClfPostLoginRole =
  | "ADMIN"
  | "PHOTOGRAPHER"
  | "LAB"
  | "LAB_PHOTOGRAPHER"
  | "CUSTOMER"
  | "ORGANIZER"
  | "SCHOOL_ORGANIZER"
  | "SUPER_ADMIN"
  | "WORKSPACE_ADMIN"
  | "STAFF"
  | string;

/**
 * Rutas de landing por rol (paridad Legacy).
 */
export const CLF_POST_LOGIN_PATHS = {
  ADMIN: "/admin",
  PHOTOGRAPHER: "/fotografo/dashboard",
  LAB: "/lab/dashboard",
  LAB_PHOTOGRAPHER: "/lab/dashboard",
  CUSTOMER: "/cliente/dashboard",
  ORGANIZER: "/organizador/dashboard",
  SCHOOL_ORGANIZER: "/escuela",
  SUPER_ADMIN: "/admin",
  WORKSPACE_ADMIN: "/",
  STAFF: "/",
  DEFAULT: "/",
} as const;

/** Redirect interno seguro (path relativo, sin open-redirect). */
export function sanitizeInternalRedirect(redirect: string | null | undefined): string {
  const value = (redirect || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  if (value.startsWith("/\\")) return "";
  return value;
}

/**
 * Resuelve el destino post-login.
 * Si hay `redirect` interno válido, tiene prioridad (compat login?redirect=…).
 */
export function getPostLoginDestination(
  role: ClfPostLoginRole | null | undefined,
  redirect?: string | null,
): string {
  const safeRedirect = sanitizeInternalRedirect(redirect);
  if (safeRedirect) return safeRedirect;

  switch (role) {
    case "ADMIN":
    case "SUPER_ADMIN":
      return CLF_POST_LOGIN_PATHS.ADMIN;
    case "PHOTOGRAPHER":
      return CLF_POST_LOGIN_PATHS.PHOTOGRAPHER;
    case "LAB":
      return CLF_POST_LOGIN_PATHS.LAB;
    case "LAB_PHOTOGRAPHER":
      return CLF_POST_LOGIN_PATHS.LAB_PHOTOGRAPHER;
    case "CUSTOMER":
      return CLF_POST_LOGIN_PATHS.CUSTOMER;
    case "ORGANIZER":
      return CLF_POST_LOGIN_PATHS.ORGANIZER;
    case "SCHOOL_ORGANIZER":
      return CLF_POST_LOGIN_PATHS.SCHOOL_ORGANIZER;
    case "WORKSPACE_ADMIN":
      return CLF_POST_LOGIN_PATHS.WORKSPACE_ADMIN;
    case "STAFF":
      return CLF_POST_LOGIN_PATHS.STAFF;
    default:
      return CLF_POST_LOGIN_PATHS.DEFAULT;
  }
}
