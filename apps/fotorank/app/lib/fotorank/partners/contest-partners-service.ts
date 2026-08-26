/**
 * Stub mínimo: `ensureContestExists` requerido por seed institucional trackeado.
 * No copia el CRM completo de partners por concurso (queda fuera de Etapa 4).
 */
import { prisma } from "@repo/db";
import { PartnersDomainError } from "@repo/partners";

export async function ensureContestExists(contestId: string) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, title: true, slug: true, organizationId: true },
  });
  if (!contest) {
    throw new PartnersDomainError("NOT_FOUND", "Concurso no encontrado.");
  }
  return contest;
}
