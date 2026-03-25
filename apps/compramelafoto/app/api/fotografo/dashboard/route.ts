import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Tipo con las relaciones que usa el dashboard (orders, photos, notifications) */
type AlbumWithDashboardRelations = Awaited<
  ReturnType<
    typeof prisma.album.findMany<{
      include: {
        orders: { include: { items: true } };
        photos: { select: { id: true } };
        notifications: { select: { id: true; email: true } };
      };
    }>
  >
>[number];

/** PrintOrder con lab e items para el dashboard */
type PrintOrderWithLabAndItems = Awaited<
  ReturnType<
    typeof prisma.printOrder.findMany<{
      include: {
        lab: { select: { name: true } };
        items: true;
      };
    }>
  >
>[number];

/**
 * GET /api/fotografo/dashboard
 *
 * Devuelve estadísticas del dashboard del fotógrafo
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
    ]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    let albums: AlbumWithDashboardRelations[];
    try {
      albums = await prisma.album.findMany({
        where: {
          userId: user.id,
        },
        include: {
          orders: {
            include: {
              items: true,
            },
          },
          photos: {
            select: {
              id: true,
            },
          },
          notifications: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (dbErr: any) {
      const msg = String(dbErr?.message ?? "");
      const missing = msg.includes("does not exist") || msg.includes("Unknown") || msg.includes("relation");
      if (!missing) throw dbErr;
      // Fallback: consulta mínima si falta alguna columna/relación en la DB
      const minimal = await prisma.album.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          title: true,
          createdAt: true,
          firstPhotoDate: true,
          userId: true,
        },
        orderBy: { createdAt: "desc" },
      });
      albums = minimal.map((a) => ({
        ...a,
        orders: [],
        photos: [],
        notifications: [],
        expirationExtensionDays: 0,
      })) as unknown as AlbumWithDashboardRelations[];
    }

    // Calcular estadísticas de ventas
    let totalSalesARS = 0;
    let digitalSalesARS = 0;
    let printSalesARS = 0;
    const salesHistory: Array<{
      date: string;
      digital: number;
      print: number;
      total: number;
    }> = [];

    albums.forEach((album) => {
      album.orders.forEach((order) => {
        if (order.status === "PAID") {
          const orderTotal = order.totalCents;
          totalSalesARS += orderTotal;

          // Nota: OrderItem puede no tener productType si es legacy
          const hasDigital = order.items.some(
            (item) => !item.productType || item.productType === "DIGITAL"
          );
          const hasPrint = order.items.some(
            (item) => item.productType === "PRINT"
          );

          if (hasDigital) {
            digitalSalesARS += orderTotal;
          }
          if (hasPrint) {
            printSalesARS += orderTotal;
          }

          // Agrupar por fecha para historial
          const dateKey = order.createdAt.toISOString().split("T")[0];
          const existing = salesHistory.find((s) => s.date === dateKey);
          if (existing) {
            existing.total += orderTotal;
            if (hasDigital) existing.digital += orderTotal;
            if (hasPrint) existing.print += orderTotal;
          } else {
            salesHistory.push({
              date: dateKey,
              digital: hasDigital ? orderTotal : 0,
              print: hasPrint ? orderTotal : 0,
              total: orderTotal,
            });
          }
        }
      });
    });

    // Estadísticas de álbumes
    const albumsStats = albums.map((album) => {
      const firstPhotoDate = album.firstPhotoDate || album.createdAt;
      const extensionDays = (album as any).expirationExtensionDays ?? 0;
      const daysSinceFirstPhoto = Math.floor(
        (Date.now() - new Date(firstPhotoDate).getTime()) /
          (24 * 60 * 60 * 1000)
      );

      let status: string;
      if (daysSinceFirstPhoto < 30 + extensionDays) {
        status = "ACTIVE";
      } else if (daysSinceFirstPhoto < 45 + extensionDays) {
        status = "EXPIRED_CLIENT";
      } else {
        status = "EXPIRED_LAB";
      }

      return {
        id: album.id,
        title: album.title,
        status,
        photosCount: album.photos.length,
        ordersCount: album.orders.filter((o) => o.status === "PAID").length,
        interestedCount: album.notifications.length,
        visibleUntil: new Date(
          new Date(firstPhotoDate).getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000
        ),
        availableUntil: new Date(
          new Date(firstPhotoDate).getTime() + (45 + extensionDays) * 24 * 60 * 60 * 1000
        ),
        expirationExtensionDays: extensionDays,
      };
    });

    // Pedidos de impresión (landing lab/fotógrafo): PrintOrder
    let printOrders: PrintOrderWithLabAndItems[];
    try {
      printOrders = await prisma.printOrder.findMany({
        where: {
          photographerId: user.id,
        },
        include: {
          lab: {
            select: {
              name: true,
            },
          },
          items: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (printErr: any) {
      console.warn("Error cargando printOrders, usando vacío:", printErr?.message);
      printOrders = [];
    }

    // Pedidos de álbum que incluyen ítems de impresión (Order con productType PRINT)
    const linkedAlbumOrderIds = new Set<number>();
    printOrders.forEach((o) => {
      const tags = Array.isArray(o.tags) ? o.tags : [];
      tags.forEach((tag) => {
        const match = String(tag).match(/^ALBUM_ORDER:(\d+)$/);
        if (match) {
          const id = Number(match[1]);
          if (Number.isFinite(id)) linkedAlbumOrderIds.add(id);
        }
      });
    });

    const albumOrdersWithPrint: Array<{
      id: number;
      source: "ALBUM_ORDER";
      buyerEmail: string;
      total: number;
      status: string;
      createdAt: Date;
      itemsCount: number;
      hasPrintItems: true;
      albumTitle?: string;
    }> = [];
    albums.forEach((album) => {
      album.orders.forEach((order) => {
        const hasPrint = order.items.some((it) => it.productType === "PRINT");
        if (hasPrint && !linkedAlbumOrderIds.has(order.id)) {
          albumOrdersWithPrint.push({
            id: order.id,
            source: "ALBUM_ORDER",
            buyerEmail: order.buyerEmail,
            total: order.totalCents,
            status: order.status,
            createdAt: order.createdAt,
            itemsCount: order.items.length,
            hasPrintItems: true,
            albumTitle: album.title,
          });
        }
      });
    });
    albumOrdersWithPrint.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({
      stats: {
        totalSalesARS,
        digitalSalesARS,
        printSalesARS,
        albumsCount: albums.length,
        activeAlbumsCount: albumsStats.filter((a) => a.status === "ACTIVE")
          .length,
        totalInterested: albums.reduce(
          (sum, a) => sum + a.notifications.length,
          0
        ),
      },
      salesHistory: salesHistory.sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
      albums: albumsStats,
      printOrders: printOrders.map((po) => ({
        id: po.id,
        source: "PRINT_ORDER" as const,
        labName: po.lab?.name ?? "Fotógrafo (sin laboratorio)",
        total: po.total,
        status: po.status,
        createdAt: po.createdAt,
        itemsCount: po.items.length,
      })),
      albumOrdersWithPrint,
    });
  } catch (error: any) {
    const detail = error?.message ?? String(error);
    console.error("Error obteniendo dashboard fotógrafo:", error);
    return NextResponse.json(
      { error: "Error obteniendo datos del dashboard", detail },
      { status: 500 }
    );
  }
}
