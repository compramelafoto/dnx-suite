import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/order-claims";

/**
 * GET /api/cliente/dashboard
 * 
 * Devuelve estadísticas del dashboard del cliente
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.CUSTOMER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    // Obtener pedidos del cliente
    const orders = await prisma.printOrder.findMany({
      where: {
        clientId: user.id,
      },
      include: {
        items: true,
        lab: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Obtener pedidos digitales (Order) del cliente
    const digitalWhere = {
      OR: [
        { buyerUserId: user.id },
        ...(user.emailVerifiedAt && user.email
          ? [{ buyerUserId: null, buyerEmail: normalizeEmail(user.email) }]
          : []),
      ],
    };

    const digitalOrders = await prisma.order.findMany({
      where: digitalWhere,
      include: {
        items: {
          include: {
            photo: {
              include: {
                album: {
                  select: {
                    id: true,
                    title: true,
                    publicSlug: true,
                    firstPhotoDate: true,
                  },
                },
              },
            },
          },
        },
        album: {
          select: {
            id: true,
            title: true,
            publicSlug: true,
            firstPhotoDate: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calcular estadísticas
    const totalOrders = orders.length + digitalOrders.length;
    const totalSpent = orders.reduce((sum, o) => sum + o.total, 0) +
      digitalOrders.reduce((sum, o) => sum + o.totalCents, 0);

    // Pedidos por estado
    const ordersByStatus = {
      PAID: orders.filter((o) => o.paymentStatus === "PAID").length,
      IN_PRODUCTION: orders.filter((o) => o.status === "IN_PRODUCTION").length,
      READY: orders.filter((o) => o.status === "READY" || o.status === "READY_TO_PICKUP").length,
      DELIVERED: orders.filter((o) => o.status === "DELIVERED").length,
    };

    // Preparar datos de descargas digitales
    // Nota: OrderItem puede no tener productType si es legacy, asumimos DIGITAL por defecto
    const digitalDownloads = digitalOrders
      .filter((order) => order.status === "PAID")
      .flatMap((order) =>
        order.items
          .filter((item) => !item.productType || item.productType === "DIGITAL")
          .map((item) => ({
            orderId: order.id,
            photoId: item.photoId,
            albumId: order.albumId,
            albumTitle: order.album.title,
            albumSlug: order.album.publicSlug,
            firstPhotoDate: order.album.firstPhotoDate,
            expiresAt: order.album.firstPhotoDate
              ? new Date(
                  new Date(order.album.firstPhotoDate).getTime() +
                    45 * 24 * 60 * 60 * 1000
                )
              : null,
          }))
      );

    // Preparar álbumes visitados (últimos álbumes donde compró)
    const visitedAlbums = digitalOrders
      .map((order) => ({
        id: order.album.id,
        title: order.album.title,
        slug: order.album.publicSlug,
        lastVisit: order.createdAt,
        purchasesCount: 1,
      }))
      .reduce((acc, album) => {
        const existing = acc.find((a) => a.id === album.id);
        if (existing) {
          existing.purchasesCount++;
          if (new Date(album.lastVisit) > new Date(existing.lastVisit)) {
            existing.lastVisit = album.lastVisit;
          }
        } else {
          acc.push(album);
        }
        return acc;
      }, [] as Array<{ id: number; title: string; slug: string; lastVisit: Date; purchasesCount: number }>)
      .sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime())
      .slice(0, 10);

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { marketingOptIn: true },
    });

    return NextResponse.json({
      marketingOptIn: me?.marketingOptIn ?? false,
      stats: {
        totalOrders,
        totalSpent,
        ordersByStatus,
      },
      orders: orders.map((o) => ({
        id: o.id,
        labName: o.lab?.name ?? "Fotógrafo",
        total: o.total,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        itemsCount: o.items.length,
      })),
      digitalDownloads,
      visitedAlbums,
    });
  } catch (error: any) {
    console.error("Error obteniendo dashboard cliente:", error);
    return NextResponse.json(
      { error: "Error obteniendo datos del dashboard", detail: error.message },
      { status: 500 }
    );
  }
}
