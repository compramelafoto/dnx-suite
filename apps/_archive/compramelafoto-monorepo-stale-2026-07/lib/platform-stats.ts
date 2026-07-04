/**
 * Estadísticas de plataforma compartidas entre admin y landing.
 * Fuente única de verdad para métricas públicas.
 */
import { prisma } from "@/lib/prisma";

/** Fecha de inicio de la plataforma: 24 de febrero de 2026 */
const PLATFORM_LAUNCH_DATE = new Date("2026-02-24T00:00:00Z");

export interface PlatformLandingStats {
  daysActive: number;
  totalUsers: number;
  totalPhotos: number;
  totalAmountSold: number;
}

export async function getPlatformLandingStats(): Promise<PlatformLandingStats> {
  const [
    totalUsers,
    totalPhotos,
    printRevenue,
    albumRevenue,
    preCompraRevenue,
  ] = await Promise.all([
    // Usuarios registrados: todos los tipos (PHOTOGRAPHER, LAB, CUSTOMER, LAB_PHOTOGRAPHER, ORGANIZER), sin contar ADMIN
    prisma.user.count({
      where: {
        role: { not: "ADMIN" },
      },
    }),
    // Total de fotos subidas (incluidas las eliminadas): todas las que se hayan subido alguna vez
    prisma.photo.count(),
    // PrintOrder: impresiones, fotos digitales desde /imprimir, carnet, polaroids
    prisma.printOrder.aggregate({
      where: { paymentStatus: "PAID" },
      _sum: { total: true },
    }),
    // Order: fotos digitales e impresas vendidas desde álbumes (/a/[id]/comprar)
    prisma.order.aggregate({
      where: { status: "PAID" },
      _sum: { totalCents: true },
    }),
    // PreCompraOrder: precompra (módulo escolar, fotos carnet, etc.)
    prisma.preCompraOrder.aggregate({
      where: { status: "PAID_HELD" },
      _sum: { totalCents: true },
    }),
  ]);

  // PrintOrder.total y Order.totalCents ya están en pesos; PreCompraOrder.totalCents está en centavos
  const printTotalPesos = printRevenue._sum.total ?? 0;
  const albumTotalPesos = albumRevenue._sum.totalCents ?? 0; // Order: ARS enteros (pesos)
  const preCompraTotalPesos = (preCompraRevenue._sum.totalCents ?? 0) / 100; // PreCompraOrder: centavos
  const totalAmountSold = printTotalPesos + albumTotalPesos + preCompraTotalPesos;

  const now = new Date();
  const daysActive = Math.max(
    0,
    Math.floor((now.getTime() - PLATFORM_LAUNCH_DATE.getTime()) / 86400000)
  );

  return {
    daysActive,
    totalUsers,
    totalPhotos,
    totalAmountSold,
  };
}
