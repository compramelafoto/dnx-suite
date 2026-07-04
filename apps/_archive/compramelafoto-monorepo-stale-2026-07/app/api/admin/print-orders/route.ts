import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación y rol ADMIN
    const { error, user } = await requireAuth([Role.ADMIN]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const orderType = searchParams.get("orderType");
    const labId = searchParams.get("labId");
    const photographerId = searchParams.get("photographerId");
    const clientId = searchParams.get("clientId");
    const q = searchParams.get("q")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = searchParams.get("sortDir") || "desc";
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const where: any = {};

    // Filtrar por status
    if (status) {
      where.status = status;
    }

    // Filtrar por paymentStatus
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    // Filtrar por orderType
    if (orderType) {
      where.orderType = orderType;
    }

    // Filtrar por labId
    if (labId) {
      where.labId = parseInt(labId);
    }

    // Filtrar por photographerId
    if (photographerId) {
      where.photographerId = parseInt(photographerId);
    }

    // Filtrar por clientId
    if (clientId) {
      where.clientId = parseInt(clientId);
    }

    // Filtrar por rango de fechas
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    // Búsqueda por texto (cliente: nombre/email/phone, ID de pedido)
    if (q) {
      const qNum = parseInt(q);
      if (!isNaN(qNum)) {
        // Si es un número, buscar por ID
        where.id = qNum;
      } else {
        // Búsqueda por texto
        where.OR = [
          { customerName: { contains: q, mode: "insensitive" } },
          { customerEmail: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q, mode: "insensitive" } },
          { mpPaymentId: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    // Ordenamiento
    const orderBy: any = {};
    orderBy[sortBy] = sortDir;

    // Paginación
    const skip = (page - 1) * pageSize;

    // Obtener total para paginación
    const total = await prisma.printOrder.count({ where });

    // Obtener pedidos
    const orders = await prisma.printOrder.findMany({
      where,
      include: {
        lab: {
          select: {
            id: true,
            name: true,
          },
        },
        photographer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            size: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            fileKey: true,
            originalName: true,
          },
        },
      },
      orderBy,
      skip,
      take: pageSize,
    });

    return NextResponse.json({
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/print-orders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo pedidos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id)) : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "ids debe ser un array con al menos un ID válido" },
        { status: 400 }
      );
    }

    // Desvincular tickets y logs para permitir borrado
    await prisma.$transaction([
      prisma.supportTicket.updateMany({
        where: { printOrderId: { in: ids } },
        data: { printOrderId: null },
      }),
      prisma.adminLog.updateMany({
        where: { printOrderId: { in: ids } },
        data: { printOrderId: null },
      }),
      prisma.printOrder.deleteMany({
        where: { id: { in: ids } },
      }),
    ]);

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "DELETE_BULK",
      entityType: "PrintOrder",
      description: `Eliminación masiva de pedidos: ${ids.join(", ")}`,
      beforeData: { ids },
      afterData: { deleted: ids.length },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err: any) {
    console.error("DELETE /api/admin/print-orders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando pedidos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
