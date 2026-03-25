import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Obtener detalle de un pedido
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const orderId = parseInt(id);

    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const order = await prisma.printOrder.findUnique({
      where: { id: orderId },
      include: {
        lab: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        photographer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
        statusHistory: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        supportTickets: {
          select: {
            id: true,
            status: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const referralEarning = await prisma.referralEarning.findFirst({
      where: { saleRef: `PRINT_ORDER:${orderId}` },
      include: {
        attribution: {
          include: {
            referrerUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
    const referral = referralEarning
      ? {
          isReferred: true,
          referrer: referralEarning.attribution?.referrerUser
            ? {
                id: referralEarning.attribution.referrerUser.id,
                name: referralEarning.attribution.referrerUser.name,
                email: referralEarning.attribution.referrerUser.email,
              }
            : null,
          referralAmountCents: referralEarning.referralAmountCents,
        }
      : { isReferred: false };

    return NextResponse.json({ ...order, referral });
  } catch (err: any) {
    console.error("GET /api/admin/print-orders/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo pedido", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar pedido
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const orderId = parseInt(id);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.supportTicket.updateMany({
        where: { printOrderId: orderId },
        data: { printOrderId: null },
      }),
      prisma.adminLog.updateMany({
        where: { printOrderId: orderId },
        data: { printOrderId: null },
      }),
      prisma.printOrder.delete({
        where: { id: orderId },
      }),
    ]);

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "DELETE",
      entityType: "PrintOrder",
      entityId: orderId,
      description: `Pedido eliminado: #${orderId}`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ ok: true, id: orderId });
  } catch (err: any) {
    console.error("DELETE /api/admin/print-orders/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando pedido", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar estado del pedido
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const orderId = parseInt(id);

    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { status, notes, internalNotes } = body;

    // Obtener pedido actual para auditoría
    const currentOrder = await prisma.printOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        internalNotes: true,
      },
    });

    if (!currentOrder) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      updateData.statusUpdatedAt = new Date();
    }
    if (internalNotes !== undefined) {
      updateData.internalNotes = internalNotes;
    }

    // Actualizar pedido
    const updatedOrder = await prisma.printOrder.update({
      where: { id: orderId },
      data: updateData,
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
      },
    });

    // Crear entrada en historial si cambió el estado
    if (status && status !== currentOrder.status) {
      try {
        await prisma.printOrderStatusHistory.create({
          data: {
            printOrderId: orderId,
            status: status,
            changedByUserId: user.id,
            notes: notes || null,
          },
        });
      } catch (historyErr: any) {
        // Si falla el historial, continuar de todas formas
        console.warn("Error creando historial de estado:", historyErr);
      }
    }

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: status ? "UPDATE_STATUS" : "UPDATE_NOTES",
      entityType: "PrintOrder",
      entityId: orderId,
      description: status
        ? `Estado cambiado de ${currentOrder.status} a ${status}`
        : "Notas internas actualizadas",
      beforeData: {
        status: currentOrder.status,
        internalNotes: currentOrder.internalNotes,
      },
      afterData: {
        status: updatedOrder.status,
        internalNotes: updatedOrder.internalNotes,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    console.error("PATCH /api/admin/print-orders/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando pedido", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
