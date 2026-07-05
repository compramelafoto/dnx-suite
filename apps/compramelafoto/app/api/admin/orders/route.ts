import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { excludeTestOrderWhere } from "@/lib/reporting/exclude-test-rows";
import {
  getAlbumOrderFulfillmentFromItems,
  prismaAlbumWhereForFulfillment,
  normalizeAdminFulfillmentParam,
  type OrderFulfillmentKind,
} from "@/lib/order-fulfillment";

type UnifiedOrder = {
  id: number;
  createdAt: Date;
  status: string;
  paymentStatus: string;
  /** Subtipo de PrintOrder en BD (solo source PRINT_ORDER). */
  orderType: string;
  /** Derivado de ítems: DIGITAL / PRINT / MIXED. */
  fulfillmentKind: OrderFulfillmentKind;
  digitalItemsCount: number;
  printItemsCount: number;
  total: number;
  currency: string;
  source: "PRINT_ORDER" | "ALBUM_ORDER";
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  lab: { id: number; name: string } | null;
  photographer: { id: number; name: string | null; email: string } | null;
  album: { id: number; title: string } | null;
  downloadLinkViewedAt?: string | null;
};

function mapOrderStatusToPaymentStatus(status: string): string {
  if (status === "PAID") return "PAID";
  if (status === "REFUNDED") return "REFUNDED";
  if (status === "CANCELED") return "FAILED";
  return "PENDING";
}

function mergeOrderWhere(base: Record<string, unknown>, fulfillment: "ALL" | OrderFulfillmentKind) {
  const extra = prismaAlbumWhereForFulfillment(fulfillment);
  if (!extra) return base;
  return { AND: [base, extra] };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const paymentStatus = searchParams.get("paymentStatus") || "";
    const fulfillment = normalizeAdminFulfillmentParam(
      searchParams.get("fulfillment") || searchParams.get("orderType")
    );
    const q = searchParams.get("q")?.trim() || "";
    const albumFilter = searchParams.get("album")?.trim() || "";
    const photographerFilter = searchParams.get("photographer")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 100);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const take = page * pageSize;

    const orders: UnifiedOrder[] = [];
    let printTotal = 0;
    let digitalTotal = 0;

    /**
     * PRINT en filtro admin = impresión “pura” (PrintOrder no espejo) + pedidos de álbum que tengan
     * al menos un ítem impreso/marco (incluye mixtos).
     */
    const includeStandalonePrints = fulfillment === "ALL" || fulfillment === "PRINT";
    const includeAlbumOrders =
      fulfillment === "ALL" ||
      fulfillment === "DIGITAL" ||
      fulfillment === "PRINT" ||
      fulfillment === "MIXED";

    if (includeStandalonePrints) {
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (paymentStatus) where.paymentStatus = paymentStatus;

      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) (where.createdAt as Record<string, Date>).gte = new Date(fromDate);
        if (toDate) (where.createdAt as Record<string, Date>).lte = new Date(toDate);
      }

      if (q) {
        const qNum = parseInt(q, 10);
        if (!Number.isNaN(qNum)) {
          where.id = qNum;
        } else {
          where.OR = [
            { customerName: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
            { customerPhone: { contains: q, mode: "insensitive" } },
            { mpPaymentId: { contains: q, mode: "insensitive" } },
            { mpPreferenceId: { contains: q, mode: "insensitive" } },
            { internalNotes: { contains: q, mode: "insensitive" } },
            { photographer: { name: { contains: q, mode: "insensitive" } } },
            { photographer: { email: { contains: q, mode: "insensitive" } } },
            { lab: { name: { contains: q, mode: "insensitive" } } },
          ];
        }
      }
      if (photographerFilter) {
        const pid = parseInt(photographerFilter, 10);
        if (!Number.isNaN(pid)) where.photographerId = pid;
      }

      const printOrdersRaw = await prisma.printOrder.findMany({
        where,
        include: {
          lab: { select: { id: true, name: true } },
          photographer: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: take + 500,
      });

      const printOrders = printOrdersRaw.filter(
        (o) => !(o.tags || []).some((t) => String(t).startsWith("ALBUM_ORDER:"))
      );

      const allPrintIds = await prisma.printOrder.findMany({
        where,
        select: { id: true, tags: true },
      });
      printTotal = allPrintIds.filter(
        (o) => !(o.tags || []).some((t) => String(t).startsWith("ALBUM_ORDER:"))
      ).length;

      printOrders.forEach((order) => {
        const printItemsCount = order._count?.items ?? 0;
        orders.push({
          id: order.id,
          createdAt: order.createdAt,
          status: order.status,
          paymentStatus: order.paymentStatus,
          orderType: order.orderType,
          fulfillmentKind: "PRINT",
          digitalItemsCount: 0,
          printItemsCount,
          total: order.total,
          currency: order.currency,
          source: "PRINT_ORDER",
          customerName: order.customerName ?? null,
          customerEmail: order.customerEmail ?? null,
          customerPhone: order.customerPhone ?? null,
          lab: order.lab ?? null,
          photographer: order.photographer ?? null,
          album: null,
        });
      });
    }

    if (includeAlbumOrders) {
      const where: Record<string, unknown> = { isTest: false };
      if (status) where.status = status;

      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) (where.createdAt as Record<string, Date>).gte = new Date(fromDate);
        if (toDate) (where.createdAt as Record<string, Date>).lte = new Date(toDate);
      }

      if (q) {
        const qNum = parseInt(q, 10);
        if (!Number.isNaN(qNum)) {
          where.id = qNum;
        } else {
          where.OR = [
            { buyerEmail: { contains: q, mode: "insensitive" } },
            { mpPaymentId: { contains: q, mode: "insensitive" } },
            { mpPreferenceId: { contains: q, mode: "insensitive" } },
            { album: { title: { contains: q, mode: "insensitive" } } },
            { album: { user: { name: { contains: q, mode: "insensitive" } } } },
            { album: { user: { email: { contains: q, mode: "insensitive" } } } },
          ];
        }
      }
      if (albumFilter || photographerFilter) {
        const albumWhere: Record<string, unknown> = {};
        if (albumFilter) {
          const albumId = parseInt(albumFilter, 10);
          if (Number.isFinite(albumId)) {
            albumWhere.id = albumId;
          } else {
            albumWhere.title = { contains: albumFilter, mode: "insensitive" };
          }
        }
        if (photographerFilter) {
          const pid = parseInt(photographerFilter, 10);
          if (Number.isFinite(pid)) albumWhere.userId = pid;
        }
        if (Object.keys(albumWhere).length > 0) {
          where.album = albumWhere;
        }
      }

      if (paymentStatus) {
        if (paymentStatus === "PAID") {
          where.status = "PAID";
        } else if (paymentStatus === "REFUNDED") {
          where.status = "REFUNDED";
        } else if (paymentStatus === "FAILED") {
          where.status = "CANCELED";
        } else if (paymentStatus === "PENDING") {
          where.status = "PENDING";
        }
      }

      const albumListWhere = mergeOrderWhere(where, fulfillment);

      digitalTotal = await prisma.order.count({ where: albumListWhere });
      const digitalOrders = await prisma.order.findMany({
        where: albumListWhere,
        include: {
          items: { select: { productType: true } },
          album: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      });

      digitalOrders.forEach((order) => {
        const f = getAlbumOrderFulfillmentFromItems(order.items);
        orders.push({
          id: order.id,
          createdAt: order.createdAt,
          status: order.status,
          paymentStatus: mapOrderStatusToPaymentStatus(order.status),
          orderType: "ALBUM",
          fulfillmentKind: f.kind,
          digitalItemsCount: f.digitalItemsCount,
          printItemsCount: f.printItemsCount,
          total: Math.round(order.totalCents),
          currency: "ARS",
          source: "ALBUM_ORDER",
          customerName: null,
          customerEmail: order.buyerEmail ?? null,
          customerPhone: null,
          lab: null,
          photographer: order.album?.user
            ? {
                id: order.album.user.id,
                name: order.album.user.name,
                email: order.album.user.email,
              }
            : null,
          album: order.album ? { id: order.album.id, title: order.album.title } : null,
          downloadLinkViewedAt: order.downloadLinkViewedAt?.toISOString() ?? null,
        });
      });
    }

    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (page - 1) * pageSize;
    const pagedOrders = orders.slice(start, start + pageSize).map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
    }));
    const total = printTotal + digitalTotal;

    let totalFacturado = 0;
    let totalFotosVendidas = 0;

    const buildPrintWhere = () => {
      const w: Record<string, unknown> = {};
      if (status) w.status = status;
      if (paymentStatus) w.paymentStatus = paymentStatus;
      if (fromDate || toDate) {
        w.createdAt = {};
        if (fromDate) (w.createdAt as Record<string, Date>).gte = new Date(fromDate);
        if (toDate) (w.createdAt as Record<string, Date>).lte = new Date(toDate);
      }
      if (q) {
        const qNum = parseInt(q, 10);
        if (!Number.isNaN(qNum)) w.id = qNum;
        else {
          w.OR = [
            { customerName: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
            { customerPhone: { contains: q, mode: "insensitive" } },
            { mpPaymentId: { contains: q, mode: "insensitive" } },
            { mpPreferenceId: { contains: q, mode: "insensitive" } },
            { internalNotes: { contains: q, mode: "insensitive" } },
            { photographer: { name: { contains: q, mode: "insensitive" } } },
            { photographer: { email: { contains: q, mode: "insensitive" } } },
            { lab: { name: { contains: q, mode: "insensitive" } } },
          ];
        }
      }
      if (photographerFilter) {
        const pid = parseInt(photographerFilter, 10);
        if (Number.isFinite(pid)) w.photographerId = pid;
      }
      w.paymentStatus = "PAID";
      return w;
    };

    const buildOrderWhere = () => {
      const w: Record<string, unknown> = { ...excludeTestOrderWhere, status: "PAID" };
      if (fromDate || toDate) {
        w.createdAt = {};
        if (fromDate) (w.createdAt as Record<string, Date>).gte = new Date(fromDate);
        if (toDate) (w.createdAt as Record<string, Date>).lte = new Date(toDate);
      }
      if (q) {
        const qNum = parseInt(q, 10);
        if (!Number.isNaN(qNum)) w.id = qNum;
        else {
          w.OR = [
            { buyerEmail: { contains: q, mode: "insensitive" } },
            { mpPaymentId: { contains: q, mode: "insensitive" } },
            { mpPreferenceId: { contains: q, mode: "insensitive" } },
            { album: { title: { contains: q, mode: "insensitive" } } },
            { album: { user: { name: { contains: q, mode: "insensitive" } } } },
            { album: { user: { email: { contains: q, mode: "insensitive" } } } },
          ];
        }
      }
      if (albumFilter || photographerFilter) {
        const albumWhere: Record<string, unknown> = {};
        if (albumFilter) {
          const albumId = parseInt(albumFilter, 10);
          if (Number.isFinite(albumId)) albumWhere.id = albumId;
          else albumWhere.title = { contains: albumFilter, mode: "insensitive" };
        }
        if (photographerFilter) {
          const pid = parseInt(photographerFilter, 10);
          if (Number.isFinite(pid)) albumWhere.userId = pid;
        }
        if (Object.keys(albumWhere).length > 0) w.album = albumWhere;
      }
      return w;
    };

    if (includeStandalonePrints) {
      const printWhere = buildPrintWhere();
      const [printSum, printPhotos] = await Promise.all([
        prisma.printOrder.aggregate({
          where: printWhere,
          _sum: { total: true },
        }),
        prisma.printOrderItem.aggregate({
          where: { order: printWhere },
          _sum: { quantity: true },
        }),
      ]);
      totalFacturado += printSum._sum.total ?? 0;
      totalFotosVendidas += printPhotos._sum.quantity ?? 0;
    }

    if (includeAlbumOrders) {
      const orderWhereSummary = mergeOrderWhere(buildOrderWhere(), fulfillment);
      const [orderSum, orderPhotos] = await Promise.all([
        prisma.order.aggregate({
          where: orderWhereSummary,
          _sum: { totalCents: true },
        }),
        prisma.orderItem.aggregate({
          where: { order: orderWhereSummary },
          _sum: { quantity: true },
        }),
      ]);
      totalFacturado += orderSum._sum.totalCents ?? 0;
      totalFotosVendidas += orderPhotos._sum.quantity ?? 0;
    }

    return NextResponse.json({
      orders: pagedOrders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      summary: {
        totalFacturado,
        totalFotosVendidas,
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/orders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo pedidos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
