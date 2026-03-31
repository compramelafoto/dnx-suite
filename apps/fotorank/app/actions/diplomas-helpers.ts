import { prisma } from "@repo/db";
import { resolveActiveOrganizationForUser } from "../lib/fotorank/dashboard-org-context";

export async function requireOrgForUser(userId: number) {
  const r = await resolveActiveOrganizationForUser(userId);
  if (!r.ok) return { ok: false as const, error: r.error };
  return { ok: true as const, organizationId: r.org.id };
}

export async function assertContestScope(contestId: string, organizationId: string) {
  return prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId },
    select: { id: true, title: true, slug: true },
  });
}
