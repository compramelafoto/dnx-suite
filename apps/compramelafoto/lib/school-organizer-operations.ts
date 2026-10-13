import { prisma } from "@/lib/prisma";
import {
  addToOperationBuckets,
  buildSchoolPortalCommissionWhere,
  buildSchoolPortalOrderWhere,
  buildSchoolPortalPreCompraWhere,
  classifyOrderStatus,
  classifyPreCompraOrder,
  emptyOperationBucketTotals,
  summarizeOrganizerCommissions,
  type OperationBucketTotals,
  type OrganizerCommissionTotals,
} from "@/lib/school-organizer-commission-logic";

/**
 * Pre-compras reales (sin pruebas) por álbum, separadas en pagadas / pendientes / canceladas /
 * reembolsadas. El reembolso se lee del Order de preventa asociado (Order.preCompraPaymentRef = id).
 * Montos en pesos.
 */
export async function loadPreCompraBucketsByAlbum(
  schoolId: number,
  albumIds: number[]
): Promise<Map<number, OperationBucketTotals>> {
  const result = new Map<number, OperationBucketTotals>();
  if (albumIds.length === 0) return result;

  const preCompras = await prisma.preCompraOrder.findMany({
    where: buildSchoolPortalPreCompraWhere(schoolId, albumIds),
    select: { id: true, albumId: true, status: true, totalCents: true },
  });
  if (preCompras.length === 0) return result;

  const linkedOrders = await prisma.order.findMany({
    where: {
      albumId: { in: albumIds },
      album: { schoolId },
      preCompraPaymentRef: { in: preCompras.map((p) => String(p.id)) },
    },
    select: { preCompraPaymentRef: true, status: true },
  });
  const linkedStatusByRef = new Map<string, string>();
  for (const o of linkedOrders) {
    if (o.preCompraPaymentRef) linkedStatusByRef.set(o.preCompraPaymentRef, o.status);
  }

  for (const p of preCompras) {
    const bucket = classifyPreCompraOrder({
      status: p.status,
      linkedOrderStatus: linkedStatusByRef.get(String(p.id)) ?? null,
    });
    const totals = result.get(p.albumId) ?? emptyOperationBucketTotals();
    addToOperationBuckets(totals, bucket, 1, Number(p.totalCents ?? 0));
    result.set(p.albumId, totals);
  }
  return result;
}

/** Pedidos (Order) reales por álbum y estado (sin pruebas ni canjes sin importe). Montos en pesos. */
export async function loadOrderBucketsByAlbum(
  schoolId: number,
  albumIds: number[]
): Promise<Map<number, OperationBucketTotals>> {
  const result = new Map<number, OperationBucketTotals>();
  if (albumIds.length === 0) return result;
  const groups = await prisma.order.groupBy({
    by: ["albumId", "status"],
    where: buildSchoolPortalOrderWhere(schoolId, albumIds),
    _count: { _all: true },
    _sum: { totalCents: true },
  });
  for (const g of groups) {
    const totals = result.get(g.albumId) ?? emptyOperationBucketTotals();
    addToOperationBuckets(
      totals,
      classifyOrderStatus(g.status),
      g._count._all,
      Number(g._sum.totalCents ?? 0)
    );
    result.set(g.albumId, totals);
  }
  return result;
}

export type SchoolPayoutRow = {
  commissionId: number;
  albumId: number;
  albumTitle: string;
  orderId: number;
  amount: number;
  paidAt: Date;
  paymentMethod: string | null;
  paymentProofUrl: string | null;
  /** Pagada y luego anulada por reembolso de la venta: saldo a compensar. */
  paidThenCancelled: boolean;
};

export async function loadCommissionsByAlbum(schoolId: number): Promise<{
  byAlbum: Map<number, OrganizerCommissionTotals>;
  payouts: SchoolPayoutRow[];
}> {
  const rows = await prisma.organizerCommission.findMany({
    where: buildSchoolPortalCommissionWhere(schoolId),
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      albumId: true,
      orderId: true,
      amount: true,
      status: true,
      paidAt: true,
      paymentMethod: true,
      paymentProofUrl: true,
      album: { select: { title: true } },
    },
  });

  const grouped = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = grouped.get(r.albumId) ?? [];
    list.push(r);
    grouped.set(r.albumId, list);
  }
  const byAlbum = new Map<number, OrganizerCommissionTotals>();
  for (const [albumId, list] of grouped) {
    byAlbum.set(albumId, summarizeOrganizerCommissions(list));
  }

  const payouts: SchoolPayoutRow[] = rows
    .filter((r) => r.paidAt != null && (r.status === "PAID" || r.status === "CANCELLED"))
    .map((r) => ({
      commissionId: r.id,
      albumId: r.albumId,
      albumTitle: r.album.title,
      orderId: r.orderId,
      amount: r.amount,
      paidAt: r.paidAt as Date,
      paymentMethod: r.paymentMethod,
      paymentProofUrl: r.paymentProofUrl,
      paidThenCancelled: r.status === "CANCELLED",
    }));

  return { byAlbum, payouts };
}
