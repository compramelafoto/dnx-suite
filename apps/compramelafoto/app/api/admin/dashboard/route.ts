import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getAppConfig } from "@/lib/services/settingsService";

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
      downloadLinkDays: config.downloadLinkDays ?? 30,
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
        where: { status: "PAID", createdAt: { gte: todayStart } },
        _sum: { totalCents: true },
      }),
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PENDING", createdAt: { gte: todayStart } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { status: "PENDING", createdAt: { gte: todayStart } },
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
        where: { status: "PAID", createdAt: { gte: weekStart } },
        _sum: { totalCents: true },
      }),
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PENDING", createdAt: { gte: weekStart } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { status: "PENDING", createdAt: { gte: weekStart } },
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
        where: { status: "PAID", createdAt: { gte: monthStart } },
        _sum: { totalCents: true },
      }),
      prisma.printOrder.aggregate({
        where: { paymentStatus: "PENDING", createdAt: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { status: "PENDING", createdAt: { gte: monthStart } },
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
        where: { createdAt: { gte: todayStart } },
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
          where: { createdAt: { gte: thirtyDaysAgo } },
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
        where: { createdAt: { gte: fourteenDaysAgo } },
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

    // Ventas diarias por tipo: impresiones físicas vs fotos digitales (últimos 30 días)
    const [printOrdersByDay, digitalPrintOrdersByDay, paidAlbumOrdersWithItems] = await Promise.all([
      prisma.printOrder.findMany({
        where: {
          paymentStatus: "PAID",
          orderType: { in: ["PRINT", "COMBO"] },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
      }),
      prisma.printOrder.findMany({
        where: {
          paymentStatus: "PAID",
          orderType: "DIGITAL",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
      }),
      prisma.order.findMany({
        where: {
          status: "PAID",
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
          items: { select: { productType: true } },
        },
      }),
    ]);

    const dailyPrintMap = new Map<string, number>();
    const dailyDigitalMap = new Map<string, number>();

    printOrdersByDay.forEach((o) => {
      const key = o.createdAt.toISOString().split("T")[0];
      dailyPrintMap.set(key, (dailyPrintMap.get(key) || 0) + 1);
    });
    digitalPrintOrdersByDay.forEach((o) => {
      const key = o.createdAt.toISOString().split("T")[0];
      dailyDigitalMap.set(key, (dailyDigitalMap.get(key) || 0) + 1);
    });
    paidAlbumOrdersWithItems.forEach((order) => {
      const key = order.createdAt.toISOString().split("T")[0];
      const hasPrint = order.items.some((i) => i.productType === "PRINT" || i.productType === "FRAME");
      const hasDigital = order.items.some((i) => i.productType === "DIGITAL");
      if (hasPrint) dailyPrintMap.set(key, (dailyPrintMap.get(key) || 0) + 1);
      if (hasDigital) dailyDigitalMap.set(key, (dailyDigitalMap.get(key) || 0) + 1);
    });

    const allDates = new Set([
      ...dailyPrintMap.keys(),
      ...dailyDigitalMap.keys(),
    ]);
    const salesByTypeByDay = Array.from(allDates)
      .sort()
      .map((date) => ({
        date: new Date(date).toISOString(),
        printCount: dailyPrintMap.get(date) || 0,
        digitalCount: dailyDigitalMap.get(date) || 0,
      }));

    // Alertas
    const alerts: any[] = [];

    // Labs pendientes de aprobación
    if (labsPending > 0) {
      alerts.push({
        type: "LABS_PENDING",
        severity: "warning",
        message: `${labsPending} laboratorio(s) pendiente(s) de aprobación`,
        count: labsPending,
        link: "/admin/laboratorios?status=PENDING",
      });
    }

    // Pedidos en producción hace más de X días
    const productionThreshold = new Date();
    productionThreshold.setDate(productionThreshold.getDate() - (config.stuckOrderDays || 7));
    
    const stuckInProduction = await prisma.printOrder.count({
      where: {
        status: "IN_PRODUCTION",
        statusUpdatedAt: { lt: productionThreshold },
      },
    });

    if (stuckInProduction > 0) {
      alerts.push({
        type: "STUCK_IN_PRODUCTION",
        severity: "warning",
        message: `${stuckInProduction} pedido(s) en producción hace más de ${config.stuckOrderDays || 7} días`,
        count: stuckInProduction,
        link: "/admin/pedidos?status=IN_PRODUCTION",
      });
    }

    // Pedidos listos para retirar hace más de 3 días
    const readyThreshold = new Date();
    readyThreshold.setDate(readyThreshold.getDate() - 3);
    
    const stuckReady = await prisma.printOrder.count({
      where: {
        status: "READY_TO_PICKUP",
        statusUpdatedAt: { lt: readyThreshold },
      },
    });

    if (stuckReady > 0) {
      alerts.push({
        type: "STUCK_READY",
        severity: "info",
        message: `${stuckReady} pedido(s) listo(s) para retirar hace más de 3 días`,
        count: stuckReady,
        link: "/admin/pedidos?status=READY_TO_PICKUP",
      });
    }

    // Pagos fallidos recientes
    if (failedPayments > 0) {
      alerts.push({
        type: "FAILED_PAYMENTS",
        severity: "error",
        message: `${failedPayments} pago(s) fallido(s) este mes`,
        count: failedPayments,
        link: "/admin/pedidos?paymentStatus=FAILED",
      });
    }

    // Tickets abiertos
    if (openTickets > 0) {
      alerts.push({
        type: "OPEN_TICKETS",
        severity: "warning",
        message: `${openTickets} incidencia(s) abierta(s)`,
        count: openTickets,
        link: "/admin/soporte?status=OPEN",
      });
    }

    // Fotógrafos sin Mercado Pago conectado
    const photographersWithoutMP = await prisma.user.count({
      where: {
        role: "PHOTOGRAPHER",
        isBlocked: false,
        OR: [
          { mpAccessToken: null },
          { mpUserId: null },
        ],
      },
    });

    if (photographersWithoutMP > 0) {
      alerts.push({
        type: "PHOTOGRAPHERS_WITHOUT_MP",
        severity: "warning",
        message: `${photographersWithoutMP} fotógrafo(s) sin Mercado Pago conectado`,
        count: photographersWithoutMP,
        link: "/admin/usuarios?role=PHOTOGRAPHER",
      });
    }

    // Laboratorios sin Mercado Pago conectado (solo aprobados y activos)
    const labsWithoutMP = await prisma.lab.count({
      where: {
        approvalStatus: "APPROVED",
        isActive: true,
        isSuspended: false,
        OR: [
          { mpAccessToken: null },
          { mpUserId: null },
        ],
      },
    });

    if (labsWithoutMP > 0) {
      alerts.push({
        type: "LABS_WITHOUT_MP",
        severity: "warning",
        message: `${labsWithoutMP} laboratorio(s) aprobado(s) sin Mercado Pago conectado`,
        count: labsWithoutMP,
        link: "/admin/laboratorios?status=APPROVED",
      });
    }

    // Estadísticas de fotos: total subidas y total vendidas
    const totalPhotosUploaded = await prisma.photo.count({
      where: { isRemoved: false },
    });

    // Fotos vendidas: OrderItems de Orders pagados + PrintOrderItems de PrintOrders pagados
    const [soldPhotosFromAlbums, soldPhotosFromPrints] = await Promise.all([
      prisma.orderItem.count({
        where: {
          order: {
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

    // 1. Ranking fotógrafos que más facturaron (Order + PrintOrder, PAID)
    const [albumBilling, printBilling] = await Promise.all([
      prisma.order.findMany({
        where: {
          status: "PAID",
          createdAt: { gte: ninetyDaysAgoRanking },
        },
        select: {
          totalCents: true,
          album: { select: { userId: true } },
        },
      }),
      prisma.printOrder.findMany({
        where: {
          paymentStatus: "PAID",
          photographerId: { not: null },
          createdAt: { gte: ninetyDaysAgoRanking },
        },
        select: {
          total: true,
          photographerId: true,
        },
      }),
    ]);

    const billingByUser = new Map<number, number>();
    albumBilling.forEach((o) => {
      const uid = o.album?.userId;
      if (uid) {
        billingByUser.set(uid, (billingByUser.get(uid) || 0) + (o.totalCents || 0));
      }
    });
    printBilling.forEach((o) => {
      const uid = o.photographerId;
      if (uid) {
        billingByUser.set(uid, (billingByUser.get(uid) || 0) + (o.total || 0));
      }
    });

    const topBillingUserIds = Array.from(billingByUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([uid]) => uid);

    const topBillingUsers = topBillingUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: topBillingUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const rankingTopBilling = topBillingUserIds.map((uid, i) => {
      const u = topBillingUsers.find((x) => x.id === uid);
      return {
        position: i + 1,
        photographerId: uid,
        name: u?.name || "—",
        email: u?.email || "—",
        total: billingByUser.get(uid) || 0,
      };
    });

    // 2. Ranking fotógrafos que más referidos recomendaron
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
      rankingTopReferrers,
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
