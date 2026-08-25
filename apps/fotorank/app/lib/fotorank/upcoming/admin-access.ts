/**
 * Autorización de las vistas administrativas de concursos próximos.
 *
 * Aislamiento entre organizadores: cada consulta se acota a la organización
 * activa del usuario. Un super admin puede actuar en nombre de otra
 * organización sólo mediante el mecanismo ya existente de "act as", que resuelve
 * `resolveActiveOrganizationForUser`.
 */

import { prisma } from "@repo/db";

import { getAuthUser, type AuthUser } from "../../auth";
import { resolveActiveOrganizationForUser } from "../dashboard-org-context";

export type AdminContestScope = {
  user: AuthUser;
  organizationId: string;
  contestId: string;
};

export type AdminScopeResult =
  | { ok: true; scope: AdminContestScope }
  | { ok: false; error: string; status: 401 | 403 | 404 };

/**
 * Resuelve el alcance administrativo para un concurso.
 * Devuelve 404 (y no 403) cuando el concurso existe pero pertenece a otra
 * organización: no confirmamos su existencia a quien no debe verlo.
 */
export async function requireAdminContestScope(contestId: string): Promise<AdminScopeResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: "Necesitás iniciar sesión.", status: 401 };

  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) return { ok: false, error: org.error, status: 403 };

  const contest = await prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId: org.org.id },
    select: { id: true },
  });
  if (!contest) return { ok: false, error: "Concurso no encontrado.", status: 404 };

  return {
    ok: true,
    scope: { user, organizationId: org.org.id, contestId: contest.id },
  };
}
