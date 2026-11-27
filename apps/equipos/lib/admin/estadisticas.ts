import { prisma } from "@repo/db";

/** Conteos del tablero del administrador (`/admin`). */

export type PortalStats = Record<
  | "identidadesAprobadas"
  | "telefonosVerificados"
  | "publicadas"
  | "enRevision"
  | "pausadas"
  | "vendidas"
  | "ventasConfirmadas"
  | "contactos30d"
  | "favoritos"
  | "alertasActivas"
  | "pedidosActivos"
  | "cuentasBloqueadas",
  number
>;

const DIA_MS = 24 * 60 * 60 * 1000;

export async function portalStats(now: Date = new Date()): Promise<PortalStats> {
  const [
    identidadesAprobadas,
    telefonosVerificados,
    porEstado,
    ventasConfirmadas,
    contactos30d,
    favoritos,
    alertasActivas,
    pedidosActivos,
    cuentasBloqueadas,
  ] = await Promise.all([
    prisma.identityVerification.count({ where: { status: "APPROVED" } }),
    prisma.phoneVerification.count({ where: { verifiedAt: { not: null } } }),
    prisma.gearListing.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.gearSale.count({ where: { status: "CONFIRMED" } }),
    prisma.gearListingContact.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DIA_MS) } } }),
    prisma.gearListingFavorite.count(),
    prisma.gearSearchAlert.count({ where: { active: true } }),
    prisma.purchaseRequest.count({ where: { status: "ACTIVE", expiresAt: { gt: now } } }),
    prisma.portalAccountBlock.count({ where: { liftedAt: null } }),
  ]);

  const estado = new Map(
    (porEstado as Array<{ status: string; _count: { _all: number } }>).map((g) => [g.status, g._count._all]),
  );
  return {
    identidadesAprobadas,
    telefonosVerificados,
    publicadas: estado.get("PUBLISHED") ?? 0,
    enRevision: estado.get("IN_REVIEW") ?? 0,
    pausadas: estado.get("PAUSED") ?? 0,
    vendidas: estado.get("SOLD") ?? 0,
    ventasConfirmadas,
    contactos30d,
    favoritos,
    alertasActivas,
    pedidosActivos,
    cuentasBloqueadas,
  };
}
