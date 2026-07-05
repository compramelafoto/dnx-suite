import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get("limit") ?? 20));

  const orderWhere: any = {
    status: "PAID",
  };

  if (q) {
    const numeric = Number(q);
    orderWhere.OR = [
      { id: numeric, status: "PAID" },
      { buyerEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  const albumOrders = await prisma.order.findMany({
    where: orderWhere,
    include: {
      album: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const printOrders = await prisma.printOrder.findMany({
    where: {
      paymentStatus: "PAID",
      ...(q
        ? {
            OR: [
              { id: Number(q) },
              { customerEmail: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const results = [
    ...albumOrders.map((order) => ({
      id: order.id,
      type: "ALBUM",
      email: order.buyerEmail,
      label: `Pedido #${order.id} · ${order.album?.title || "Álbum"}`,
      createdAt: order.createdAt,
    })),
    ...printOrders.map((order) => ({
      id: order.id,
      type: "PRINT",
      email: order.customerEmail || order.customerName || "Cliente",
      label: `Print #${order.id} · ${order.customerName || "Cliente"}`,
      createdAt: order.createdAt,
    })),
  ];

  return NextResponse.json({ orders: results.slice(0, limit) });
}
