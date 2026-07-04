import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const photographerId = searchParams.get("photographerId");
    const search = searchParams.get("search") || "";

    if (!photographerId || !Number.isFinite(Number(photographerId))) {
      return NextResponse.json(
        { error: "photographerId es requerido" },
        { status: 400 }
      );
    }

    const id = Number(photographerId);

    // Solo pedidos CONFIRMADOS (pagados): el fotógrafo no ve clientes hasta que paguen
    const orders = await prisma.printOrder.findMany({
      where: {
        photographerId: id,
        paymentStatus: "PAID",
      },
      select: {
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        createdAt: true,
        total: true,
        currency: true,
        id: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Agrupar por cliente único (por email o teléfono + nombre)
    const clientesMap = new Map<string, {
      name: string | null;
      email: string | null;
      phone: string | null;
      firstOrderDate: Date;
      lastOrderDate: Date;
      totalOrders: number;
      totalSpent: number;
      currency: string;
      lastOrderId: number;
      lastOrderStatus: string;
    }>();

    orders.forEach((order) => {
      const key = order.customerEmail || order.customerPhone || order.customerName || `order-${order.id}`;
      
      if (!clientesMap.has(key)) {
        clientesMap.set(key, {
          name: order.customerName,
          email: order.customerEmail,
          phone: order.customerPhone,
          firstOrderDate: order.createdAt,
          lastOrderDate: order.createdAt,
          totalOrders: 1,
          totalSpent: order.total,
          currency: order.currency,
          lastOrderId: order.id,
          lastOrderStatus: order.status,
        });
      } else {
        const cliente = clientesMap.get(key)!;
        cliente.totalOrders += 1;
        cliente.totalSpent += order.total;
        if (order.createdAt > cliente.lastOrderDate) {
          cliente.lastOrderDate = order.createdAt;
          cliente.lastOrderId = order.id;
          cliente.lastOrderStatus = order.status;
        }
        if (order.createdAt < cliente.firstOrderDate) {
          cliente.firstOrderDate = order.createdAt;
        }
        // Actualizar datos si están vacíos
        if (!cliente.name && order.customerName) cliente.name = order.customerName;
        if (!cliente.email && order.customerEmail) cliente.email = order.customerEmail;
        if (!cliente.phone && order.customerPhone) cliente.phone = order.customerPhone;
      }
    });

    // Convertir a array y filtrar por búsqueda
    let clientes = Array.from(clientesMap.values()).map((cliente, idx) => ({
      id: idx + 1,
      name: cliente.name || "Sin nombre",
      email: cliente.email || "Sin email",
      phone: cliente.phone || "Sin teléfono",
      firstOrderDate: cliente.firstOrderDate.toISOString(),
      lastOrderDate: cliente.lastOrderDate.toISOString(),
      totalOrders: cliente.totalOrders,
      totalSpent: cliente.totalSpent,
      currency: cliente.currency,
      lastOrderId: cliente.lastOrderId,
      lastOrderStatus: cliente.lastOrderStatus,
    }));

    // Filtrar por búsqueda si existe
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      clientes = clientes.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower) ||
          c.phone.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json(clientes, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/fotografo/clientes ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo clientes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
