import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Listar tickets
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
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50"), 100);

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * pageSize;
    const total = await prisma.supportTicket.count({ where });

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        printOrder: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/support/tickets ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo tickets", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// POST: Crear ticket
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { printOrderId, reason, description, requesterName, requesterEmail, requesterPhone, requesterRole } = body;

    if (!reason || !description) {
      return NextResponse.json(
        { error: "reason y description son requeridos" },
        { status: 400 }
      );
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        printOrderId: printOrderId ? parseInt(printOrderId) : null,
        reason,
        description,
        requesterName: requesterName || null,
        requesterEmail: requesterEmail || null,
        requesterPhone: requesterPhone || null,
        requesterRole: requesterRole || null,
        status: "OPEN",
      },
    });

    return NextResponse.json({ success: true, ticket });
  } catch (err: any) {
    console.error("POST /api/admin/support/tickets ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando ticket", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
