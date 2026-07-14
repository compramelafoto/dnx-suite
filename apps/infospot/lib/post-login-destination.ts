/**
 * Destino post-login Info Spot (perfiles públicos + editorial).
 * Lógica pura para tests; la carga async vive en google-login.ts.
 */

import { safeInfoSpotNextPath } from "./google-oauth-start";

const EDITORIAL_PATHS = ["/redaccion", "/admin"] as const;

export function isEditorialIntentPath(path: string | null | undefined): boolean {
  const value = typeof path === "string" ? path.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  return EDITORIAL_PATHS.some((p) => value === p || value.startsWith(`${p}/`));
}

export type PostLoginDestinationInput = {
  suiteRole: string;
  membershipRole: string | null;
  membershipStatus: string | null;
  next?: string | null;
  /** Tiene InfoSpotUserRole ACTIVE o SUPER_ADMIN. */
  hasEditorialAccess: boolean;
  /** Completó /completar-perfil. */
  onboardingCompleted: boolean;
  /** Al menos un DnxUserProfile ACTIVE. */
  hasActivePublicProfile: boolean;
  /** Invitación editorial PENDING para este email. */
  hasPendingEditorialInvite?: boolean;
};

export type PostLoginDestination = {
  path: string;
  hasEditorialAccess: boolean;
  reason:
    | "editorial"
    | "editorial_denied"
    | "onboarding"
    | "home"
    | "next"
    | "invite_hint";
};

/**
 * Reglas:
 * 1. next editorial sin membresía → acceso-pendiente
 * 2. editorial con acceso → next seguro o /redaccion
 * 3. sin onboarding y sin perfiles (y no editorial) → /completar-perfil
 * 4. resto → next seguro o /
 */
export function resolveInfoSpotPostLoginDestination(
  params: PostLoginDestinationInput,
): PostLoginDestination {
  const next = safeInfoSpotNextPath(params.next, "");
  const wantsEditorial = isEditorialIntentPath(next) || next === "";

  // Caso explícito: pidió redacción/admin sin rol.
  if (isEditorialIntentPath(next) && !params.hasEditorialAccess) {
    return {
      path: "/ingresar/acceso-pendiente",
      hasEditorialAccess: false,
      reason: "editorial_denied",
    };
  }

  if (params.hasEditorialAccess) {
    if (next && next !== "/ingresar" && next !== "/ingresar/acceso-pendiente" && next !== "/completar-perfil") {
      return { path: next, hasEditorialAccess: true, reason: "next" };
    }
    // Login default editorial (next vacío o /redaccion implícito del form).
    if (!next || next === "/redaccion" || wantsEditorial) {
      return { path: "/redaccion", hasEditorialAccess: true, reason: "editorial" };
    }
    return { path: next || "/redaccion", hasEditorialAccess: true, reason: "next" };
  }

  // Público: onboarding si hace falta (excepto si ya tiene perfiles o completó).
  const needsOnboarding = !params.onboardingCompleted && !params.hasActivePublicProfile;
  if (needsOnboarding) {
    return {
      path: "/completar-perfil",
      hasEditorialAccess: false,
      reason: "onboarding",
    };
  }

  if (next && next !== "/" && next !== "/ingresar" && next !== "/ingresar/acceso-pendiente" && next !== "/completar-perfil") {
    if (isEditorialIntentPath(next)) {
      return {
        path: "/ingresar/acceso-pendiente",
        hasEditorialAccess: false,
        reason: "editorial_denied",
      };
    }
    return { path: next, hasEditorialAccess: false, reason: "next" };
  }

  if (params.hasPendingEditorialInvite) {
    return {
      path: "/completar-perfil?invitacion=1",
      hasEditorialAccess: false,
      reason: "invite_hint",
    };
  }

  return { path: "/", hasEditorialAccess: false, reason: "home" };
}
