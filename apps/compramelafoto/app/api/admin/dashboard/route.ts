import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPhotosUploadedTotal } from "@/lib/platform-metrics";
import { excludeTestOrderWhere } from "@/lib/reporting/exclude-test-rows";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getAppConfig } from "@/lib/services/settingsService";
import { getAdminDashboardAlerts } from "@/lib/admin/admin-dashboard-alerts";
import { computeSalesDailyAvgByMonth } from "@/lib/admin/sales-daily-avg-by-month";
import { computeSalesPeakHoursStudy } from "@/lib/admin/sales-peak-hours-study";
import { computeAlbumWeeklyEffectiveness } from "@/lib/admin/album-weekly-effectiveness";
import { computePhotographerSalesRanking } from "@/lib/admin/photographer-weekly-sales";
import { computeAlbumUploadDelaySales } from "@/lib/admin/album-upload-delay-sales";
import { computePhotographerFirstAlbumOnboarding } from "@/lib/admin/photographer-first-album-onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    let config: {
      stuckOrderDays?: number;
      downloadLinkDays?: number;
      photoDeletionDays?: number;
      maintenanceMode?: boolean;
    };
    try {
      config = (await getAppConfig()) ?? {};
    } catch (configErr: any) {
      console.warn("Error obteniendo configuración, usando valores por defecto:", configErr?.message ?? configErr);
      config = {};
    }
    config = {
      stuckOrderDays: config.stuckOrderDays ?? 7,
      downloadLinkDays: config.downloadLinkDays ?? 15,
      photoDeletionDays: config.photoDeletionDays ?? 45,
      maintenanceMode: config.maintenanceMode ?? false,
    };
    
    const TZ = "America/Argentina/Buenos_Aires";
    const now = new Date();
    // Inicio de "hoy" en hora Argentina (evita desfase si el servidor está en UTC)
    const parts = new Intl.DateTimeFormat("es-AR", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parseInt(parts.find((p) => p.type === "year")!.value, 10);
    const m = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
    const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
    const todayStart = new Date(Date.UTC(y, m, d, 3, 0, 0, 0)); // 03:00 UTC = 00:00 Argentina (UTC-3)
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(Date.UTC(y, m, 1, 3, 0, 0, 0));

    // Ventas: confirmadas (PAID), pendientes (PENDING), con error (FAILED/REFUNDED)
    const [
      salesTodayPaidPrint,
      salesTodayPaidOrder,
      salesTodayPendingPrint,
      salesTodayPendingOrder,
      salesTodayFailedPrint,
      salesTodayFailedOrder,
    ] = await Promise.all([
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PAID", createdAt: { gte: todayStart } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { ...excludeTestOrderWhere, status: "PAID", createdAt: { gte: todayStart } },
        _sum: { totalCents: true },
      }),
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PENDING", createdAt: { gte: todayStart } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { ...excludeTestOrderWhere, status: "PENDING", createdAt: { gte: todayStart } },
        _sum: { totalCents: true },
      }),
      prisma.printOrder.aggregate({
        where: {
          paymentStatus: { in: ["FAILED", "REFUNDED"] },
          createdAt: { gte: todayStart },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          ...excludeTestOrderWhere,
          status: { in: ["REFUNDED", "CANCELED"] },
          createdAt: { gte: todayStart },
        },
        _sum: { totalCents: true },
      }),
    ]);
    const salesTodayConfirmed =
      (salesTodayPaidPrint._sum.total || 0) + (salesTodayPaidOrder._sum.totalCents || 0);
    const salesTodayPending =
      (salesTodayPendingPrint._sum.total || 0) + (salesTodayPendingOrder._sum.totalCents || 0);
    const salesTodayFailed =
      (salesTodayFailedPrint._sum.total || 0) + (salesTodayFailedOrder._sum.totalCents || 0);

    const [
      salesWeekPaidPrint,
      salesWeekPaidOrder,
      salesWeekPendingPrint,
      salesWeekPendingOrder,
      salesWeekFailedPrint,
      salesWeekFailedOrder,
    ] = await Promise.all([
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PAID", createdAt: { gte: weekStart } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { ...excludeTestOrderWhere, status: "PAID", createdAt: { gte: weekStart } },
        _sum: { totalCents: true },
      }),
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PENDING", createdAt: { gte: weekStart } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { ...excludeTestOrderWhere, status: "PENDING", createdAt: { gte: weekStart } },
        _sum: { totalCents: true },
      }),
      prisma.printOrder.aggregate({
        where: {
          paymentStatus: { in: ["FAILED", "REFUNDED"] },
          createdAt: { gte: weekStart },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          ...excludeTestOrderWhere,
          status: { in: ["REFUNDED", "CANCELED"] },
          createdAt: { gte: weekStart },
        },
        _sum: { totalCents: true },
      }),
    ]);
    const salesWeekConfirmed =
      (salesWeekPaidPrint._sum.total || 0) + (salesWeekPaidOrder._sum.totalCents || 0);
    const salesWeekPending =
      (salesWeekPendingPrint._sum.total || 0) + (salesWeekPendingOrder._sum.totalCents || 0);
    const salesWeekFailed =
      (salesWeekFailedPrint._sum.total || 0) + (salesWeekFailedOrder._sum.totalCents || 0);

    const [
      salesMonthPaidPrint,
      salesMonthPaidOrder,
      salesMonthPendingPrint,
      salesMonthPendingOrder,
      salesMonthFailedPrint,
      salesMonthFailedOrder,
    ] = await Promise.all([
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PAID", createdAt: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { ...excludeTestOrderWhere, status: "PAID", createdAt: { gte: monthStart } },
        _sum: { totalCents: true },
      }),
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PENDING", createdAt: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { ...excludeTestOrderWhere, status: "PENDING", createdAt: { gte: monthStart } },
        _sum: { totalCents: true },
      }),
      prisma.printOrder.aggregate({
        where: {
          paymentStatus: { in: ["FAILED", "REFUNDED"] },
          createdAt: { gte: monthStart },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          ...excludeTestOrderWhere,
          status: { in: ["REFUNDED", "CANCELED"] },
          createdAt: { gte: monthStart },
        },
        _sum: { totalCents: true },
      }),
    ]);
    const salesMonthConfirmed =
      (salesMonthPaidPrint._sum.total || 0) + (salesMonthPaidOrder._sum.totalCents || 0);
    const salesMonthPending =
      (salesMonthPendingPrint._sum.total || 0) + (salesMonthPendingOrder._sum.totalCents || 0);
    const salesMonthFailed =
      (salesMonthFailedPrint._sum.total || 0) + (salesMonthFailedOrder._sum.totalCents || 0);

    // Pedidos hoy: PrintOrder + Order (álbum)
    const [ordersTodayPrint, ordersTodayOrder] = await Promise.all([
      prisma.printOrder.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.order.count({
        where: { ...excludeTestOrderWhere, createdAt: { gte: todayStart } },
      }),
    ]);
    const ordersToday = ordersTodayPrint + ordersTodayOrder;

    // Pedidos por tipo (últimos 30 días): PrintOrder + Order (álbum)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let ordersPrint = 0;
    let ordersDigital = 0;
    let ordersAlbum = 0;
    let ordersPaidToday = 0;
    let ordersPaid30d = 0;
    let ordersCanceled30d = 0;
    let ordersPending30d = 0;

    try {
      const [
        printCount,
        digitalCount,
        albumCount,
        paidTodayPrint,
        paidTodayOrder,
        paid30Print,
        paid30Order,
        canceled30Print,
        canceled30Order,
        pending30Print,
        pending30Order,
      ] = await Promise.all([
        prisma.printOrder.count({
          where: {
            orderType: "PRINT",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.printOrder.count({
          where: {
            orderType: "DIGITAL",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.order.count({
          where: { ...excludeTestOrderWhere, createdAt: { gte: thirtyDaysAgo } },
        }),
        // Pedidos efectivos (pagados) hoy
        prisma.printOrder.count({
          where: {
            paymentStatus: "PAID",
            createdAt: { gte: todayStart },
          },
        }),
        prisma.order.count({
          where: {
            ...excludeTestOrderWhere,
            status: "PAID",
            createdAt: { gte: todayStart },
          },
        }),
        // Pedidos efectivos (pagados) últimos 30 días
        prisma.printOrder.count({
          where: {
            paymentStatus: "PAID",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.order.count({
          where: {
            ...excludeTestOrderWhere,
            status: "PAID",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        // Pedidos cancelados/reembolsados (30d)
        prisma.printOrder.count({
          where: {
            paymentStatus: { in: ["REFUNDED", "FAILED"] },
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.order.count({
          where: {
            ...excludeTestOrderWhere,
            status: { in: ["REFUNDED", "CANCELED"] },
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        // Pedidos pendientes (no finalizados) (30d)
        prisma.printOrder.count({
          where: {
            paymentStatus: "PENDING",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.order.count({
          where: {
            ...excludeTestOrderWhere,
            status: "PENDING",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
      ]);
      ordersPrint = printCount;
      ordersDigital = digitalCount;
      ordersAlbum = albumCount;
      ordersPaidToday = paidTodayPrint + paidTodayOrder;
      ordersPaid30d = paid30Print + paid30Order;
      ordersCanceled30d = canceled30Print + canceled30Order;
      ordersPending30d = pending30Print + pending30Order;
    } catch (err: any) {
      console.warn("Error contando pedidos por tipo:", err);
    }

    // Laboratorios
    const labsActive = await prisma.lab.count({
      where: {
        approvalStatus: "APPROVED",
        isActive: true,
      },
    });

    const labsPending = await prisma.lab.count({
      where: {
        approvalStatus: "PENDING",
      },
    });

    // Pedidos trabados (sin cambios de estado en X días)
    const stuckDate = new Date();
    stuckDate.setDate(stuckDate.getDate() - (config.stuckOrderDays || 7));
    const stuckOrders = await prisma.printOrder.count({
      where: {
        statusUpdatedAt: { lt: stuckDate },
        AND: [
          { status: { not: "DELIVERED" } },
          { status: { not: "CANCELED" } },
        ],
      },
    });

    // Pagos fallidos
    const failedPayments = await prisma.printOrder.count({
      where: {
        paymentStatus: "FAILED",
        createdAt: { gte: monthStart },
      },
    });

    // Incidencias abiertas (puede no existir hasta que se ejecute la migración)
    let openTickets = 0;
    try {
      // @ts-ignore - Modelo puede no existir aún hasta que se ejecute la migración
      openTickets = await prisma.supportTicket.count({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      });
    } catch (err: any) {
      // Si el modelo no existe, simplemente retornar 0
      openTickets = 0;
    }

    // Fotógrafos activos: PHOTOGRAPHER o LAB_PHOTOGRAPHER con álbum o pedido en los últimos 90 días
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let photographersActive = 0;
    let clientsActive = 0;
    try {
      photographersActive = await prisma.user.count({
        where: {
          role: { in: ["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"] },
          OR: [
            {
              albums: {
                some: { createdAt: { gte: ninetyDaysAgo } },
              },
            },
            {
              printOrders: {
                some: { createdAt: { gte: ninetyDaysAgo } },
              },
            },
          ],
          isBlocked: false,
        },
      });

      // Clientes activos: compradores con pedido de álbum (Order) o de impresión (PrintOrder) en los últimos 90 días
      const [clientsWithAlbumOrders, clientsWithPrintOrders] = await Promise.all([
        prisma.user.findMany({
          where: {
            buyerOrders: {
              some: { createdAt: { gte: ninetyDaysAgo } },
            },
            isBlocked: false,
          },
          select: { id: true },
        }),
        prisma.user.findMany({
          where: {
            role: "CUSTOMER",
            clientOrders: {
              some: { createdAt: { gte: ninetyDaysAgo } },
            },
            isBlocked: false,
          },
          select: { id: true },
        }),
      ]);
      const clientsActiveSet = new Set([
        ...clientsWithAlbumOrders.map((u) => u.id),
        ...clientsWithPrintOrders.map((u) => u.id),
      ]);
      clientsActive = clientsActiveSet.size;
    } catch (countErr: any) {
      console.warn("Error contando fotógrafos/clientes activos:", countErr?.message ?? countErr);
    }

    // Pagos pendientes (últimos 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const pendingPayments = await prisma.printOrder.count({
      where: {
        paymentStatus: "PENDING",
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Ventas últimos 30 días (agrupadas por día): PrintOrder + Order (centavos → pesos por día)
    const [paidPrintOrders, paidAlbumOrders] = await Promise.all([
      prisma.printOrder.findMany({
        where: {
          paymentStatus: "PAID",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true, total: true },
      }),
      prisma.order.findMany({
        where: {
          ...excludeTestOrderWhere,
          status: "PAID",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true, totalCents: true },
      }),
    ]);

    const salesByDayMap = new Map<string, number>();
    paidPrintOrders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      const pesos = order.total || 0;
      salesByDayMap.set(dateKey, (salesByDayMap.get(dateKey) || 0) + pesos);
    });
    paidAlbumOrders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      const pesos = order.totalCents || 0;
      salesByDayMap.set(dateKey, (salesByDayMap.get(dateKey) || 0) + pesos);
    });

    const salesData = Array.from(salesByDayMap.entries())
      .map(([date, amount]) => ({
        date: new Date(date).toISOString(),
        amount: Math.round(amount),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Pedidos por estado (solo PrintOrder; Order usa estados distintos y se ve en Pedidos Álbum)
    const ordersByStatusRaw = await prisma.printOrder.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const ordersByStatus = ordersByStatusRaw.map((item) => ({
      status: item.status,
      count: item._count.id,
    }));

    // Pedidos últimos 14 días: PrintOrder + Order
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [ordersLast14Print, ordersLast14Album] = await Promise.all([
      prisma.printOrder.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.order.findMany({
        where: { ...excludeTestOrderWhere, createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    const ordersByDayMap = new Map<string, number>();
    ordersLast14Print.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      ordersByDayMap.set(dateKey, (ordersByDayMap.get(dateKey) || 0) + 1);
    });
    ordersLast14Album.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      ordersByDayMap.set(dateKey, (ordersByDayMap.get(dateKey) || 0) + 1);
    });

    const ordersByDay = Array.from(ordersByDayMap.entries())
      .map(([date, count]) => ({
        date: new Date(date).toISOString(),
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Ventas últimos 14 días: PrintOrder + Order (centavos → pesos)
    const [salesLast14Print, salesLast14Album] = await Promise.all([
      prisma.printOrder.findMany({
        where: {
          paymentStatus: "PAID",
          createdAt: { gte: fourteenDaysAgo },
        },
        select: { createdAt: true, total: true },
      }),
      prisma.order.findMany({
        where: {
          ...excludeTestOrderWhere,
          status: "PAID",
          createdAt: { gte: fourteenDaysAgo },
        },
        select: { createdAt: true, totalCents: true },
      }),
    ]);

    const salesByDayMap14 = new Map<string, number>();
    salesLast14Print.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      const pesos = order.total || 0;
      salesByDayMap14.set(dateKey, (salesByDayMap14.get(dateKey) || 0) + pesos);
    });
    salesLast14Album.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      const pesos = order.totalCents || 0;
      salesByDayMap14.set(dateKey, (salesByDayMap14.get(dateKey) || 0) + pesos);
    });

    const salesByDay = Array.from(salesByDayMap14.entries())
      .map(([date, amount]) => ({
        date: new Date(date).toISOString(),
        amount: Math.round(amount),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Ventas diarias por tipo: impresiones físicas vs digitales en ARS (últimos 30 días)
    const [printOrdersByDay, digitalPrintOrdersByDay, paidAlbumOrdersWithItems] = await Promise.all([
      prisma.printOrder.findMany({
        where: {
          paymentStatus: "PAID",
          orderType: { in: ["PRINT", "COMBO"] },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true, total: true },
      }),
      prisma.printOrder.findMany({
        where: {
          paymentStatus: "PAID",
          orderType: "DIGITAL",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true, total: true },
      }),
      prisma.order.findMany({
        where: {
          ...excludeTestOrderWhere,
          status: "PAID",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
          items: { select: { productType: true, subtotalCents: true, quantity: true } },
        },
      }),
    ]);

    const dailyPrintCount = new Map<string, number>();
    const dailyDigitalCount = new Map<string, number>();
    const dailyPrintAmount = new Map<string, number>();
    const dailyDigitalAmount = new Map<string, number>();

    printOrdersByDay.forEach((o) => {
      const key = o.createdAt.toISOString().split("T")[0];
      dailyPrintCount.set(key, (dailyPrintCount.get(key) || 0) + 1);
      dailyPrintAmount.set(key, (dailyPrintAmount.get(key) || 0) + (o.total || 0));
    });
    digitalPrintOrdersByDay.forEach((o) => {
      const key = o.createdAt.toISOString().split("T")[0];
      dailyDigitalCount.set(key, (dailyDigitalCount.get(key) || 0) + 1);
      dailyDigitalAmount.set(key, (dailyDigitalAmount.get(key) || 0) + (o.total || 0));
    });
    paidAlbumOrdersWithItems.forEach((order) => {
      const key = order.createdAt.toISOString().split("T")[0];
      let printItems = 0;
      let digitalItems = 0;
      let printSubtotal = 0;
      let digitalSubtotal = 0;

      for (const item of order.items) {
        const subtotal = item.subtotalCents || 0;
        const qty = item.quantity || 1;
        if (item.productType === "PRINT" || item.productType === "FRAME") {
          printItems += qty;
          printSubtotal += subtotal;
        } else if (item.productType === "DIGITAL") {
          digitalItems += qty;
          digitalSubtotal += subtotal;
        }
      }

      if (printItems > 0) {
        dailyPrintCount.set(key, (dailyPrintCount.get(key) || 0) + printItems);
        dailyPrintAmount.set(key, (dailyPrintAmount.get(key) || 0) + printSubtotal);
      }
      if (digitalItems > 0) {
        dailyDigitalCount.set(key, (dailyDigitalCount.get(key) || 0) + digitalItems);
        dailyDigitalAmount.set(key, (dailyDigitalAmount.get(key) || 0) + digitalSubtotal);
      }
    });

    const allDates = new Set([
      ...dailyPrintCount.keys(),
      ...dailyDigitalCount.keys(),
      ...dailyPrintAmount.keys(),
      ...dailyDigitalAmount.keys(),
    ]);
    const salesByTypeByDay = Array.from(allDates)
      .sort()
      .map((date) => {
        const printAmount = dailyPrintAmount.get(date) || 0;
        const digitalAmount = dailyDigitalAmount.get(date) || 0;
        return {
          date: new Date(date).toISOString(),
          printCount: dailyPrintCount.get(date) || 0,
          digitalCount: dailyDigitalCount.get(date) || 0,
          printAmount: Math.round(printAmount),
          digitalAmount: Math.round(digitalAmount),
          totalAmount: Math.round(printAmount + digitalAmount),
        };
      });

    const [alerts, salesDailyAvgByMonth, salesPeakHoursStudy] = await Promise.all([
      getAdminDashboardAlerts(prisma, config),
      computeSalesDailyAvgByMonth(prisma, 12),
      computeSalesPeakHoursStudy(prisma, 90),
    ]);

    // Estadísticas de fotos: total histórico subidas y total vendidas
    const totalPhotosUploaded = await getPhotosUploadedTotal();
    const activePhotosInDb = await prisma.photo.count({
      where: { isRemoved: false, storageCleanupStatus: "ACTIVE" },
    });
    // Fotos cuyo archivo ya se borró de R2 por la retención de 45 días.
    // activePhotos baja y purgedPhotos sube a medida que el cron limpia.
    const purgedPhotosInDb = await prisma.photo.count({
      where: { storageCleanupStatus: { not: "ACTIVE" } },
    });

    // Fotos vendidas: OrderItems de Orders pagados + PrintOrderItems de PrintOrders pagados
    const [soldPhotosFromAlbums, soldPhotosFromPrints] = await Promise.all([
      prisma.orderItem.count({
        where: {
          order: {
            ...excludeTestOrderWhere,
            status: "PAID",
          },
        },
      }),
      prisma.printOrderItem.count({
        where: {
          order: {
            paymentStatus: "PAID",
          },
        },
      }),
    ]);
    const totalPhotosSold = soldPhotosFromAlbums + soldPhotosFromPrints;
    const salesConversionRate = totalPhotosUploaded > 0
      ? Math.round((totalPhotosSold / totalPhotosUploaded) * 100 * 100) / 100 // 2 decimales
      : 0;

    // Rankings últimos 90 días
    const ninetyDaysAgoRanking = new Date();
    ninetyDaysAgoRanking.setDate(ninetyDaysAgoRanking.getDate() - 90);

    const photographerSalesRanking = await computePhotographerSalesRanking(prisma, 90);
    const rankingTopBilling = photographerSalesRanking.slice(0, 10).map((row) => ({
      position: row.rank,
      photographerId: row.photographerId,
      name: row.name || "—",
      email: row.email,
      total: row.totalAmount,
    }));

    // Ranking fotógrafos que más referidos recomendaron
    const referralCounts = await prisma.referralAttribution.groupBy({
      by: ["referrerUserId"],
      where: {
        createdAt: { gte: ninetyDaysAgoRanking },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const topReferrerIds = referralCounts.map((r) => r.referrerUserId);
    const topReferrerUsers = topReferrerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: topReferrerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const rankingTopReferrers = referralCounts.map((r, i) => {
      const u = topReferrerUsers.find((x) => x.id === r.referrerUserId);
      return {
        position: i + 1,
        photographerId: r.referrerUserId,
        name: u?.name || "—",
        email: u?.email || "—",
        referralsCount: r._count.id,
      };
    });

    let funnelDaily: Array<{
      id: string;
      createdAt: Date;
      event: string;
      albumId: number | null;
      albumTitle: string | null;
      photographerName: string | null;
      userName: string | null;
    }> = [];
    const funnelTodayByEvent: Record<string, { visits: number; visitors: number }> = {};
    try {
      const funnelCutoff = new Date();
      funnelCutoff.setDate(funnelCutoff.getDate() - 30);
      funnelDaily = await prisma.$queryRaw<
        Array<{
          id: string;
          createdAt: Date;
          event: string;
          albumId: number | null;
          albumTitle: string | null;
          photographerName: string | null;
          userName: string | null;
        }>
      >`
        SELECT f."id",
               f."createdAt",
               f."event",
               COALESCE(f."albumId", o."albumId") AS "albumId",
               a."title" AS "albumTitle",
               u."name" AS "photographerName",
               bu."name" AS "userName"
        FROM "FunnelVisit" f
        LEFT JOIN "Order" o ON o."id" = f."orderId"
        LEFT JOIN "Album" a ON a."id" = COALESCE(f."albumId", o."albumId")
        LEFT JOIN "User" u ON u."id" = a."userId"
        LEFT JOIN "User" bu ON bu."id" = f."userId"
        WHERE f."createdAt" >= ${funnelCutoff}
        ORDER BY f."createdAt" DESC
        LIMIT 1000
      `;
      const rowsToday = await prisma.$queryRaw<
        Array<{ event: string; visits: number; visitors: number }>
      >`
        SELECT "event",
               COUNT(*)::int AS visits,
               COUNT(DISTINCT "visitorKey")::int AS visitors
        FROM "FunnelVisit"
        WHERE "createdAt" >= ${todayStart}
        GROUP BY 1
      `;
      for (const r of rowsToday) {
        funnelTodayByEvent[r.event] = { visits: r.visits, visitors: r.visitors };
      }
    } catch (funnelErr) {
      console.warn("[admin/dashboard] funnel stats omitidas:", funnelErr);
    }

    let albumWeeklyEffectiveness: Awaited<
      ReturnType<typeof computeAlbumWeeklyEffectiveness>
    > = [];
    try {
      albumWeeklyEffectiveness = await computeAlbumWeeklyEffectiveness(prisma, 90);
    } catch (effectivenessErr) {
      console.warn("[admin/dashboard] album weekly effectiveness omitido:", effectivenessErr);
    }

    let albumUploadDelaySales: Awaited<ReturnType<typeof computeAlbumUploadDelaySales>> | null =
      null;
    try {
      albumUploadDelaySales = await computeAlbumUploadDelaySales(prisma, 18);
    } catch (uploadDelayErr) {
      console.warn("[admin/dashboard] album upload delay sales omitido:", uploadDelayErr);
    }

    let photographerFirstAlbumOnboarding: Awaited<
      ReturnType<typeof computePhotographerFirstAlbumOnboarding>
    > = [];
    try {
      photographerFirstAlbumOnboarding = await computePhotographerFirstAlbumOnboarding(prisma, 90);
    } catch (onboardingErr) {
      console.warn("[admin/dashboard] photographer first album onboarding omitido:", onboardingErr);
    }

    return NextResponse.json({
      stats: {
        salesToday: salesTodayConfirmed,
        salesWeek: salesWeekConfirmed,
        salesMonth: salesMonthConfirmed,
        salesTodayConfirmed,
        salesTodayPending,
        salesTodayFailed,
        salesWeekConfirmed,
        salesWeekPending,
        salesWeekFailed,
        salesMonthConfirmed,
        salesMonthPending,
        salesMonthFailed,
        ordersToday,
        ordersPaidToday,
        ordersPaid30d,
        ordersCanceled30d,
        ordersPending30d,
        ordersPrint,
        ordersDigital,
        ordersAlbum,
        labsActive,
        labsPending,
        photographersActive,
        clientsActive,
        pendingPayments,
        stuckOrders,
        failedPayments,
        openTickets,
        totalPhotosUploaded,
        activePhotosInDb,
        purgedPhotosInDb,
        totalPhotosSold,
        salesConversionRate,
      },
      salesData,
      ordersByStatus,
      ordersByDay,
      salesByDay,
      salesByTypeByDay,
      alerts,
      rankingTopBilling,
      photographerSalesRanking,
      rankingTopReferrers,
      funnelDaily: funnelDaily.map((r) => ({
        id: r.id,
        occurredAt:
          r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        event: r.event,
        albumId: r.albumId != null ? Number(r.albumId) : null,
        albumTitle: r.albumTitle ?? null,
        photographerName: r.photographerName ?? null,
        userName: r.userName ?? null,
      })),
      funnelTodayByEvent,
      albumWeeklyEffectiveness,
      albumUploadDelaySales,
      photographerFirstAlbumOnboarding,
      salesDailyAvgByMonth,
      salesPeakHoursStudy,
    });
  } catch (err: any) {
    const message = err?.message ?? (typeof err === "string" ? err : "Error desconocido");
    const detail = typeof err?.message === "string" ? err.message : String(err);
    console.error("GET /api/admin/dashboard ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error obteniendo dashboard",
        detail: detail || message,
        code: err?.code,
      },
      { status: 500 }
    );
  }
}
