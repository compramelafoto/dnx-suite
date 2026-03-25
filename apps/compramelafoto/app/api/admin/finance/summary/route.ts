import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const printWhere: any = { paymentStatus: "PAID" };
    const orderWhere: any = { status: "PAID" };

    if (fromDate || toDate) {
      const dateFilter: any = {};
      if (fromDate) dateFilter.gte = new Date(fromDate);
      if (toDate) dateFilter.lte = new Date(toDate);
      printWhere.createdAt = dateFilter;
      orderWhere.createdAt = dateFilter;
    }

    // PrintOrder (impresiones) + Order (álbumes): todas las ventas
    const [printSales, printPlatform, printLab, printPhotographer, printCount, orderSales, orderPlatform, orderCount] =
      await Promise.all([
        prisma.printOrder.aggregate({ where: printWhere, _sum: { total: true } }),
        prisma.printOrder.aggregate({ where: printWhere, _sum: { platformCommission: true } }),
        prisma.printOrder.aggregate({ where: printWhere, _sum: { labCommission: true } }),
        prisma.printOrder.aggregate({ where: printWhere, _sum: { photographerCommission: true } }),
        prisma.printOrder.count({ where: printWhere }),
        prisma.order.aggregate({ where: orderWhere, _sum: { totalCents: true } }),
        prisma.order.aggregate({ where: orderWhere, _sum: { platformCommissionCents: true } }),
        prisma.order.count({ where: orderWhere }),
      ]);

    const salesTotal = (printSales._sum.total ?? 0) + (orderSales._sum.totalCents ?? 0);
    const platformCommission =
      (printPlatform._sum.platformCommission ?? 0) + (orderPlatform._sum.platformCommissionCents ?? 0);
    const labCommission = printLab._sum.labCommission ?? 0;
    const photographerCommission = printPhotographer._sum.photographerCommission ?? 0;
    const ordersCount = printCount + orderCount;

    return NextResponse.json({
      salesTotal,
      platformCommission,
      labCommission,
      photographerCommission,
      ordersCount,
      netPlatform: platformCommission,
    });
  } catch (err: any) {
    console.error("GET /api/admin/finance/summary ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo resumen financiero", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
