/**
 * GET /api/admin/order-audit
 * Auditoría antifraude: OrderAuditLog (eventos de pedidos, pagos, liberación de datos)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

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
    const eventType = searchParams.get("eventType")?.trim();
    const targetOrderType = searchParams.get("targetOrderType")?.trim();
    const targetOrderId = searchParams.get("targetOrderId")?.trim();
    const actorUserId = searchParams.get("actorUserId")?.trim();
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);
    const fromDate = searchParams.get("fromDate")?.trim();
    const toDate = searchParams.get("toDate")?.trim();

    const andConditions: object[] = [];

    if (eventType) {
      andConditions.push({ eventType: { contains: eventType, mode: "insensitive" as const } });
    }
    if (targetOrderType) {
      andConditions.push({ targetOrderType: { equals: targetOrderType } });
    }
    if (targetOrderId && /^\d+$/.test(targetOrderId)) {
      andConditions.push({ targetOrderId: parseInt(targetOrderId) });
    }
    if (actorUserId && /^\d+$/.test(actorUserId)) {
      andConditions.push({ actorUserId: parseInt(actorUserId) });
    }
    if (fromDate || toDate) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (fromDate) createdAt.gte = new Date(fromDate);
      if (toDate) createdAt.lte = new Date(toDate);
      andConditions.push({ createdAt });
    }

    const where = andConditions.length ? { AND: andConditions } : {};
    const skip = (page - 1) * pageSize;
    const total = await prisma.orderAuditLog.count({ where });

    const logs = await prisma.orderAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/order-audit ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error obteniendo auditoría de pedidos",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
