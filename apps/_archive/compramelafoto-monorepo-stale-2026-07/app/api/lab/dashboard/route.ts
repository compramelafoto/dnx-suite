import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lab/dashboard
 * 
 * Devuelve estadísticas del dashboard del laboratorio
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.LAB, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    // Obtener laboratorio
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { id: true, defaultSlaDays: true },
    });

    if (!lab) {
      return NextResponse.json(
        { error: "Laboratorio no encontrado" },
        { status: 404 }
      );
    }

    // Obtener pedidos del laboratorio (solo pagados)
    const allOrders = await prisma.printOrder.findMany({
      where: {
        labId: lab.id,
        paymentStatus: "PAID",
      },
      include: {
        items: true,
        photographer: {
          select: {
            id: true,
            name: true,
            address: true,
            companyAddress: true,
          },
        },
        statusHistory: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calcular KPIs
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyOrders = allOrders.filter(
      (o) => o.createdAt >= startOfMonth
    ).length;

    const ordersInProduction = allOrders.filter(
      (o) => o.status === "IN_PRODUCTION"
    ).length;

    const ordersReady = allOrders.filter(
      (o) => o.status === "READY" || o.status === "READY_TO_PICKUP"
    ).length;

    const ordersDelivered = allOrders.filter(
      (o) => o.status === "DELIVERED"
    ).length;

    const ordersCreated = allOrders.filter(
      (o) => o.status === "CREATED"
    ).length;

    const ordersShipped = allOrders.filter(
      (o) => o.status === "SHIPPED"
    ).length;

    // Calcular ingresos del mes
    const monthlyRevenue = allOrders
      .filter((o) => o.createdAt >= startOfMonth && o.status !== "CANCELED")
      .reduce((sum, o) => sum + o.total, 0);

    // Calcular ingresos totales
    const totalRevenue = allOrders
      .filter((o) => o.status !== "CANCELED")
      .reduce((sum, o) => sum + o.total, 0);

    // Calcular SLA promedio (días entre creación y cambio a READY o DELIVERED)
    const completedOrders = allOrders.filter(
      (o) => o.status === "READY" || o.status === "DELIVERED" || o.status === "SHIPPED" || o.status === "RETIRED"
    );

    let totalSlaDays = 0;
    let slaCount = 0;

    completedOrders.forEach((order) => {
      const lastStatusChange = order.statusHistory[0]?.createdAt || order.statusUpdatedAt;
      if (lastStatusChange) {
        const slaDays = Math.floor(
          (lastStatusChange.getTime() - order.createdAt.getTime()) /
            (24 * 60 * 60 * 1000)
        );
        totalSlaDays += slaDays;
        slaCount++;
      }
    });

    const averageSlaDays =
      slaCount > 0 ? Math.round(totalSlaDays / slaCount) : lab.defaultSlaDays || 5;

    // Pedidos pendientes de producción (no finalizados)
    // SHIPPED y RETIRED son estados finales (ya recibido por el cliente)
    const pendingStatuses = ["CREATED", "IN_PRODUCTION", "READY_TO_PICKUP"];
    const pendingOrders = allOrders
      .filter((o) => pendingStatuses.includes(o.status))
      .slice(0, 50)
      .map((order) => ({
        id: order.id,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        photographerId: order.photographerId,
        photographerName: order.photographer?.name || null,
        createdAt: order.createdAt.toISOString(),
        statusUpdatedAt: order.statusUpdatedAt.toISOString(),
        status: order.status,
        total: order.total,
        currency: order.currency,
        itemsCount: order.items.length,
        pickupBy: order.pickupBy,
      }));

    // Preparar pedidos recientes para el dashboard (todos los estados)
    const recentOrders = allOrders.slice(0, 20).map((order) => ({
      id: order.id,
      customerName: order.customerName,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      total: order.total,
      currency: order.currency,
      itemsCount: order.items.length,
      pickupBy: order.pickupBy,
    }));

    // Preparar descargas disponibles (pedidos con estado READY o superior)
    const availableDownloads = allOrders
      .filter(
        (o) =>
          o.status === "READY" ||
          o.status === "READY_TO_PICKUP" ||
          o.status === "SHIPPED" ||
          o.status === "RETIRED" ||
          o.status === "DELIVERED"
      )
      .map((order) => ({
        id: order.id,
        customerName: order.customerName,
        createdAt: order.createdAt,
        status: order.status,
        expiresAt: new Date(
          order.createdAt.getTime() + 45 * 24 * 60 * 60 * 1000
        ),
        itemsCount: order.items.length,
      }));

    return NextResponse.json({
      stats: {
        monthlyOrders,
        ordersInProduction,
        ordersReady,
        ordersDelivered,
        ordersCreated,
        ordersShipped,
        monthlyRevenue,
        totalRevenue,
        averageSlaDays,
        pendingCount: pendingOrders.length,
      },
      pendingOrders,
      recentOrders,
      availableDownloads,
    });
  } catch (error: any) {
    console.error("Error obteniendo dashboard laboratorio:", error);
    return NextResponse.json(
      { error: "Error obteniendo datos del dashboard", detail: error.message },
      { status: 500 }
    );
  }
}
