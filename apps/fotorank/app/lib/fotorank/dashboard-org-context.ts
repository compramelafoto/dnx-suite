import { cookies } from "next/headers";
import { prisma } from "@repo/db";
import { isGlobalSuperAdmin } from "@repo/auth";
import {
  FOTORANK_SA_ACT_AS_ORG_COOKIE,
  listAllOrganizationsForSuperAdmin,
} from "./access/super-admin";
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
 * - Super Admin: todas las orgs; prioriza «Actuar como…» y cookie activa.
 * - Organizador: membresías ACTIVE; con varias orgs exige cookie válida.
 * - Con una sola: esa organización (determinístico).
 */
export async function resolveActiveOrganizationForUser(userId: number): Promise<ActiveOrgResolution> {
  const identity = await prisma.user.findUnique({
    where: { id: userId },
    select: { globalRole: true, role: true },
  });
  const isSuperAdmin = isGlobalSuperAdmin(identity ?? {});

  const orgs = isSuperAdmin
    ? await listAllOrganizationsForSuperAdmin()
    : await getUserOrganizations(userId);

  if (orgs.length === 0) {
    return { ok: false, error: "No tenés ninguna organización activa.", code: "NO_ORGS" };
  }

  const cookieStore = await cookies();
  const actAsOrgId = isSuperAdmin
    ? cookieStore.get(FOTORANK_SA_ACT_AS_ORG_COOKIE)?.value?.trim() || null
    : null;
  const fromCookie = cookieStore.get(FOTORANK_ACTIVE_ORG_COOKIE)?.value?.trim() ?? null;

  for (const candidate of [actAsOrgId, fromCookie]) {
    if (!candidate) continue;
    const match = orgs.find((o) => o.id === candidate);
    if (match) return { ok: true, org: match };
  }

  if (fromCookie && !isSuperAdmin) {
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

  if (isSuperAdmin) {
    return {
      ok: false,
      error:
        "Como Super Admin, elegí una organización en el selector o usá «Actuar como…» desde Super Admin.",
      code: "NEEDS_CHOICE",
    };
  }

  return {
    ok: false,
    error: "Tenés más de una organización. Elegí cuál usar para Jurados en el selector de arriba.",
    code: "NEEDS_CHOICE",
  };
}
