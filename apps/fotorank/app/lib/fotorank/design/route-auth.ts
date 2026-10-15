import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "../../auth";
import { resolveActiveOrganizationForUser } from "../dashboard-org-context";

/** Sesión + organización activa + concurso de esa organización, para las rutas de ganadores. */
export async function requireContestOrganizer(
  contestId: string,
): Promise<
  | { ok: true; userId: number; organizationId: string }
  | { ok: false; status: number; error: string }
> {
  const user = await getAuthUser();
  if (!user) return { ok: false, status: 401, error: "No autorizado." };
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) return { ok: false, status: 403, error: org.error };
  const concurso = await prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId: org.org.id },
    select: { id: true },
  });
  if (!concurso) return { ok: false, status: 404, error: "Concurso no encontrado." };
  return { ok: true, userId: user.id, organizationId: org.org.id };
}
