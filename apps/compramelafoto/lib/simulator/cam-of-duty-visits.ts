/** Reglas de la entrada a Cam Of Duty, sin base ni sesión (ver cam-of-duty-access.ts). */

/** Volver antes de esto no cuenta como otra entrada (recargar la página, por ejemplo). */
export const VISIT_GAP_MS = 30 * 60 * 1000;

export function isNewVisit(lastVisitAt: Date, now: Date): boolean {
  return now.getTime() - lastVisitAt.getTime() >= VISIT_GAP_MS;
}

/** Páginas de acceso con la estética de Cam Of Duty (por detrás, cuentas de fotógrafo de CLF). */
export const CAMOFDUTY_PATHS = {
  login: "/camofduty/ingresar",
  signup: "/camofduty/registro",
  verify: "/camofduty/verificar",
  complete: "/camofduty/completar",
} as const;

export type CamOfDutyStep = keyof typeof CAMOFDUTY_PATHS;

/** Página de acceso que vuelve a `path` al terminar. */
export function camOfDutyAccessUrl(step: CamOfDutyStep, path: string): string {
  return `${CAMOFDUTY_PATHS[step]}?redirect=${encodeURIComponent(path)}`;
}

/** Sin sesión se ofrece ingresar (y desde ahí, registrarse). */
export function camOfDutySignupUrl(path: string): string {
  return camOfDutyAccessUrl("login", path);
}

/** Roles que entran: fotógrafos (también los de laboratorio) y administradores. */
const PHOTOGRAPHER_ROLES = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ADMIN"]);

export type CamOfDutyGate = "ok" | "not-photographer" | "verify" | "complete";

/**
 * Qué le falta a una cuenta para usar Cam Of Duty: ser de fotógrafo, haber
 * validado el email con el código y tener los datos completos.
 */
export function camOfDutyGate(user: {
  role: string;
  globalRole?: string | null;
  emailVerifiedAt: Date | null;
  profileComplete: boolean;
}): CamOfDutyGate {
  const admin = user.globalRole === "SUPER_ADMIN" || user.role === "ADMIN";
  if (!admin && !PHOTOGRAPHER_ROLES.has(user.role)) return "not-photographer";
  if (!user.emailVerifiedAt) return "verify";
  if (!user.profileComplete && !admin) return "complete";
  return "ok";
}
