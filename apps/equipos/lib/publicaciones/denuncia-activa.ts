import { prisma } from "@repo/db";

/**
 * Denuncias ACTIVE de OTRA persona sobre una serie. Lo usan publicar, reanudar, aprobar, la ficha
 * pública y el cruce diario. Puede haber más de una: el orden es fijo (la más vieja primero) para
 * que la nota interna y los avisos citen siempre la misma.
 */
export async function findActiveReportForSerial(
  serialNormalized: string,
  sellerId: number,
): Promise<{ id: number } | null> {
  return prisma.stolenGearReport.findFirst({
    where: { serialNormalized, status: "ACTIVE", reporterId: { not: sellerId } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
}

/** Todas las denuncias activas de otras personas sobre la serie, la más vieja primero. */
export async function findActiveReportsForSerial(
  serialNormalized: string,
  sellerId: number,
): Promise<{ id: number }[]> {
  return prisma.stolenGearReport.findMany({
    where: { serialNormalized, status: "ACTIVE", reporterId: { not: sellerId } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
}
