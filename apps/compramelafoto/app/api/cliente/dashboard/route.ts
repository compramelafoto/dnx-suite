import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/order-claims";
import { isDownloadCenterRolloutActive } from "@/lib/digital-download/download-center-rollout";
import { computeDownloadAvailability, resolveDownloadLinkDays } from "@/lib/digital-download/download-link-policy";
import { getAppConfig } from "@/lib/services/settingsService";

export type ClientDigitalDownloadOrder = {
  orderId: number;
  orderCreatedAt: string;
  albumId: number;
  albumTitle: string;
  albumSlug: string | null;
  photographerName: string | null;
  digitalPhotoCount: number;
  expiresAt: string;
  expiresAtLabel: string;
  availabilityStatus: "available" | "expiring_soon" | "expired";
  daysRemaining: number;
  downloadCenterRolloutActive: boolean;
};

function isDigitalOrderItem(productType: string | null | undefined): boolean {
  return !productType || productType === "DIGITAL";
}

function countDigitalPhotos(
  items: Array<{ photoId: number; productType: string }>
): number {
  const photoIds = new Set<number>();
  for (const item of items) {
    if (!isDigitalOrderItem(item.productType)) continue;
    if (Number.isFinite(item.photoId)) photoIds.add(item.photoId);
  }
  return photoIds.size;
}

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
          select: {
            photoId: true,
            productType: true,
          },
        },
        album: {
          select: {
            id: true,
            title: true,
            publicSlug: true,
            deletedAt: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const config = await getAppConfig();
    const downloadDays = resolveDownloadLinkDays(config);

    const paidDigitalOrderIds = digitalOrders
      .filter((order) => order.status === "PAID")
      .filter((order) => countDigitalPhotos(order.items) > 0)
      .map((order) => order.id);

    const orderLevelTokens =
      paidDigitalOrderIds.length > 0
        ? await prisma.orderDownloadToken.findMany({
            where: {
              orderId: { in: paidDigitalOrderIds },
              type: "CLIENT_DIGITAL",
              photoId: null,
            },
            orderBy: { createdAt: "desc" },
            select: {
              orderId: true,
              expiresAt: true,
            },
          })
        : [];

    const expiresAtByOrderId = new Map<number, Date>();
    for (const token of orderLevelTokens) {
      if (token.orderId == null || expiresAtByOrderId.has(token.orderId)) continue;
      expiresAtByOrderId.set(token.orderId, token.expiresAt);
    }

    // 1 tarjeta = 1 pedido pagado con al menos una foto digital
    const digitalDownloads = digitalOrders
      .filter((order) => order.status === "PAID")
      .flatMap((order): ClientDigitalDownloadOrder[] => {
        const digitalPhotoCount = countDigitalPhotos(order.items);
        if (digitalPhotoCount === 0) return [];

        const albumDeleted = Boolean(order.album.deletedAt);
        const fallbackExpiresAt = new Date(
          order.createdAt.getTime() + downloadDays * 24 * 60 * 60 * 1000
        );
        const expiresAt =
          expiresAtByOrderId.get(order.id) ?? fallbackExpiresAt;
        const availability = computeDownloadAvailability(expiresAt);
        const effectiveAvailability = albumDeleted
          ? {
              status: "expired" as const,
              daysRemaining: 0,
              expiresAtIso: availability.expiresAtIso,
              expiresAtLabel: availability.expiresAtLabel,
            }
          : availability;

        const photographerName =
          order.album.user.name?.trim() ||
          order.album.user.email?.trim() ||
          null;

        return [
          {
            orderId: order.id,
            orderCreatedAt: order.createdAt.toISOString(),
            albumId: order.albumId,
            albumTitle: order.album.title,
            albumSlug: order.album.publicSlug,
            photographerName,
            digitalPhotoCount,
            expiresAt: effectiveAvailability.expiresAtIso,
            expiresAtLabel: effectiveAvailability.expiresAtLabel,
            availabilityStatus: effectiveAvailability.status,
            daysRemaining: effectiveAvailability.daysRemaining,
            downloadCenterRolloutActive: isDownloadCenterRolloutActive(order.createdAt),
          },
        ];
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
