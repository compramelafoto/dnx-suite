import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

type UnifiedOrder = {
  id: number;
  createdAt: Date;
  status: string;
  paymentStatus: string;
  orderType: string;
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
    const status = searchParams.get("status") || "";
    const paymentStatus = searchParams.get("paymentStatus") || "";
    const orderType = searchParams.get("orderType") || "";
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

    const includePrintOrders = orderType !== "DIGITAL";
    const includeDigitalOrders = !orderType || orderType === "DIGITAL";

    if (includePrintOrders) {
      const where: any = {};
      if (status) where.status = status;
      if (paymentStatus) where.paymentStatus = paymentStatus;
      if (orderType) where.orderType = orderType;

      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) where.createdAt.lte = new Date(toDate);
      }

      if (q) {
        const qNum = parseInt(q, 10);
        if (!Number.isNaN(qNum)) {
          where.id = qNum;
        } else {
          // Búsqueda en toda la BD por cualquier campo relevante
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
        where.photographerId = parseInt(photographerFilter, 10);
        if (Number.isNaN(where.photographerId)) delete where.photographerId;
      }

      const printOrdersRaw = await prisma.printOrder.findMany({
        where,
        include: {
          lab: { select: { id: true, name: true } },
          photographer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: take + 500, // Traer de más para compensar los espejos que filtramos
      });

      // Excluir PrintOrders que son espejo de pedidos de álbum (tag ALBUM_ORDER:123)
      // Esos ya aparecen como ALBUM_ORDER; mostrarlos duplicaría el monto
      const printOrders = printOrdersRaw.filter(
        (o) => !(o.tags || []).some((t) => String(t).startsWith("ALBUM_ORDER:"))
      );

      // Count sin espejos (para paginación correcta)
      const allPrintIds = await prisma.printOrder.findMany({
        where,
        select: { id: true, tags: true },
      });
      printTotal = allPrintIds.filter(
        (o) => !(o.tags || []).some((t) => String(t).startsWith("ALBUM_ORDER:"))
      ).length;

      printOrders.forEach((order) => {
        orders.push({
          id: order.id,
          createdAt: order.createdAt,
          status: order.status,
          paymentStatus: order.paymentStatus,
          orderType: order.orderType,
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

    if (includeDigitalOrders) {
      const where: any = {};
      if (status) where.status = status;

      if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) where.createdAt.lte = new Date(toDate);
      }

      if (q) {
        const qNum = parseInt(q, 10);
        if (!Number.isNaN(qNum)) {
          where.id = qNum;
        } else {
          // Búsqueda en toda la BD por cualquier campo relevante
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
        const albumWhere: any = {};
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

      digitalTotal = await prisma.order.count({ where });
      const digitalOrders = await prisma.order.findMany({
        where,
        include: {
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
        orders.push({
          id: order.id,
          createdAt: order.createdAt,
          status: order.status,
          paymentStatus: mapOrderStatusToPaymentStatus(order.status),
          orderType: "DIGITAL",
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

    // Resumen: suma facturado y fotos vendidas (solo pedidos PAGADOS que coinciden con los filtros)
    let totalFacturado = 0;
    let totalFotosVendidas = 0;

    const buildPrintWhere = () => {
      const w: any = {};
      if (status) w.status = status;
      if (paymentStatus) w.paymentStatus = paymentStatus;
      if (orderType) w.orderType = orderType;
      if (fromDate || toDate) {
        w.createdAt = {};
        if (fromDate) w.createdAt.gte = new Date(fromDate);
        if (toDate) w.createdAt.lte = new Date(toDate);
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
      const w: any = { status: "PAID" };
      if (fromDate || toDate) {
        w.createdAt = {};
        if (fromDate) w.createdAt.gte = new Date(fromDate);
        if (toDate) w.createdAt.lte = new Date(toDate);
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
        const albumWhere: any = {};
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

    if (includePrintOrders) {
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

    if (includeDigitalOrders) {
      const orderWhere = buildOrderWhere();
      const [orderSum, orderPhotos] = await Promise.all([
        prisma.order.aggregate({
          where: orderWhere,
          _sum: { totalCents: true },
        }),
        prisma.orderItem.aggregate({
          where: { order: orderWhere },
          _sum: { quantity: true },
        }),
      ]);
      totalFacturado += orderSum._sum.totalCents ?? 0; // Order.totalCents ya está en ARS enteros
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
