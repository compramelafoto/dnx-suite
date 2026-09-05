/**
 * Estadísticas de plataforma compartidas entre admin y landing.
 * Fuente única de verdad para métricas públicas agregadas.
 */
import { prisma } from "@/lib/prisma";
import { excludeTestOrderWhere } from "@/lib/reporting/exclude-test-rows";
import { getPhotosUploadedTotal } from "@/lib/platform-metrics";

/** Fecha de inicio de la plataforma: 24 de febrero de 2026 */
const PLATFORM_LAUNCH_DATE = new Date("2026-02-24T00:00:00Z");

export interface PlatformLandingStats {
  daysActive: number;
  totalUsers: number;
  /** Solo cuentas de fotógrafo (incluye fotógrafos de laboratorio). */
  totalPhotographers: number;
  totalPhotos: number;
  totalAmountSold: number;
}

export const LANDING_STATS_PUBLIC_KEYS = [
  "daysActive",
  "totalUsers",
  "totalPhotographers",
  "totalPhotos",
  "totalAmountSold",
] as const;

export async function getPlatformLandingStats(): Promise<PlatformLandingStats> {
  const [totalUsers, totalPhotographers, totalPhotos, printRevenue, albumRevenue, preCompraRevenue] =
    await Promise.all([
      prisma.user.count({
        where: {
          role: { not: "ADMIN" },
        },
      }),
      prisma.user.count({
        where: {
          role: { in: ["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"] },
        },
      }),
      getPhotosUploadedTotal(),
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PAID" },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { ...excludeTestOrderWhere, status: "PAID" },
        _sum: { totalCents: true },
      }),
      // Staging aún no tiene PreCompraOrder.isTest (drift vs schema). Filtrar solo por status.
      prisma.preCompraOrder.aggregate({
        where: { status: "PAID_HELD" },
        _sum: { totalCents: true },
      }),
    ]);

  const printTotalPesos = printRevenue._sum.total ?? 0;
  const albumTotalPesos = albumRevenue._sum.totalCents ?? 0;
  const preCompraTotalPesos = (preCompraRevenue._sum.totalCents ?? 0) / 100;
  const totalAmountSold = printTotalPesos + albumTotalPesos + preCompraTotalPesos;

  const now = new Date();
  const daysActive = Math.max(
    0,
    Math.floor((now.getTime() - PLATFORM_LAUNCH_DATE.getTime()) / 86400000)
  );

  return {
    daysActive,
    totalUsers,
    totalPhotographers,
    totalPhotos,
    totalAmountSold,
  };
}
