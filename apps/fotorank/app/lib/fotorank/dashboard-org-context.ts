import { cookies } from "next/headers";
import { getUserOrganizations, type UserOrganization } from "./organizations";

/** Cookie httpOnly: organización activa explícita para el dashboard (p. ej. módulo Jurados). */
export const FOTORANK_ACTIVE_ORG_COOKIE = "fotorank_active_org_id";
export const FOTORANK_ACTIVE_ORG_MAX_AGE = 60 * 60 * 24 * 400; // ~13 meses

export type ActiveOrgResolution =
  | { ok: true; org: UserOrganization }
  | {
      ok: false;
      error: string;
      code: "NO_ORGS" | "NEEDS_CHOICE" | "INVALID_COOKIE";
    };

/**
 * Resuelve la organización activa para el usuario.
 * - Con varias organizaciones: exige cookie válida (sin usar orgs[0]).
 * - Con una sola: esa organización (determinístico, no hay ambigüedad).
 */
export async function resolveActiveOrganizationForUser(userId: number): Promise<ActiveOrgResolution> {
  const orgs = await getUserOrganizations(userId);
  if (orgs.length === 0) {
    return { ok: false, error: "No tenés ninguna organización activa.", code: "NO_ORGS" };
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(FOTORANK_ACTIVE_ORG_COOKIE)?.value?.trim() ?? null;

  if (fromCookie) {
    const match = orgs.find((o) => o.id === fromCookie);
    if (match) return { ok: true, org: match };
    return {
      ok: false,
      error:
        "La organización seleccionada ya no es válida o no tenés acceso. Elegí otra organización en el selector.",
      code: "INVALID_COOKIE",
    };
  }

  if (orgs.length === 1) {
    return { ok: true, org: orgs[0]! };
  }

  return {
    ok: false,
    error: "Tenés más de una organización. Elegí cuál usar para Jurados en el selector de arriba.",
    code: "NEEDS_CHOICE",
  };
}
