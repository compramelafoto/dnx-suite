import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role, LabApprovalStatus } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Obtener detalle de un laboratorio
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
    const labId = parseInt(id);

    if (!Number.isFinite(labId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            phone: true,
            createdAt: true,
          },
        },
        basePrices: {
          orderBy: { size: "asc" },
        },
        discounts: {
          orderBy: [{ size: "asc" }, { minQty: "asc" }],
        },
        products: {
          orderBy: { name: "asc" },
        },
        orders: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            total: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    return NextResponse.json(lab);
  } catch (err: any) {
    console.error("GET /api/admin/labs/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo laboratorio", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar estado de aprobación o suspensión
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
    const labId = parseInt(id);

    if (!Number.isFinite(labId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { approvalStatus, isSuspended, suspendedReason, internalNotes, commissionOverrideBps } = body;

    // Obtener lab actual para auditoría
    const currentLab = await prisma.lab.findUnique({
      where: { id: labId },
      select: {
        id: true,
        name: true,
        approvalStatus: true,
        isSuspended: true,
        suspendedReason: true,
        internalNotes: true,
        commissionOverrideBps: true,
      },
    });

    if (!currentLab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    const updateData: any = {};

    if (approvalStatus && ["PENDING", "APPROVED", "REJECTED"].includes(approvalStatus)) {
      updateData.approvalStatus = approvalStatus as LabApprovalStatus;
      // Activar solo si está aprobado y no está suspendido
      if (approvalStatus === "APPROVED" && !isSuspended) {
        updateData.isActive = true;
      } else if (approvalStatus === "REJECTED") {
        updateData.isActive = false;
      }
    }

    if (isSuspended !== undefined) {
      updateData.isSuspended = isSuspended;
      if (isSuspended) {
        updateData.suspendedAt = new Date();
        updateData.suspendedReason = suspendedReason || null;
        updateData.isActive = false;
      } else {
        updateData.suspendedAt = null;
        updateData.suspendedReason = null;
        // Reactivar solo si está aprobado
        if (currentLab.approvalStatus === "APPROVED") {
          updateData.isActive = true;
        }
      }
    }

    if (suspendedReason !== undefined && isSuspended) {
      updateData.suspendedReason = suspendedReason;
    }

    if (internalNotes !== undefined) {
      updateData.internalNotes = internalNotes;
    }

    if (commissionOverrideBps !== undefined) {
      if (commissionOverrideBps === null || commissionOverrideBps === "") {
        updateData.commissionOverrideBps = null;
      } else {
        const parsed = Number(commissionOverrideBps);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000) {
          return NextResponse.json(
            { error: "commissionOverrideBps debe estar entre 0 y 10000 (bps) o null" },
            { status: 400 }
          );
        }
        updateData.commissionOverrideBps = Math.round(parsed);
      }
    }

    // Actualizar laboratorio
    const updatedLab = await prisma.lab.update({
      where: { id: labId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    let actionDesc = "";
    if (approvalStatus) {
      actionDesc = `Estado de aprobación cambiado de ${currentLab.approvalStatus} a ${approvalStatus}`;
    } else if (isSuspended !== undefined) {
      actionDesc = isSuspended ? "Laboratorio suspendido" : "Laboratorio reactivado";
    } else if (internalNotes !== undefined) {
      actionDesc = "Notas internas actualizadas";
    } else if (commissionOverrideBps !== undefined) {
      actionDesc = "Fee del laboratorio actualizado";
    }

    await logAdminAction({
      action:
        approvalStatus
          ? "APPROVE_LAB"
          : isSuspended !== undefined
          ? "SUSPEND_LAB"
          : internalNotes !== undefined
          ? "UPDATE_LAB_NOTES"
          : "UPDATE_LAB_FEE",
      entityType: "Lab",
      entityId: labId,
      description: actionDesc,
      beforeData: {
        approvalStatus: currentLab.approvalStatus,
        isSuspended: currentLab.isSuspended,
        internalNotes: currentLab.internalNotes,
        commissionOverrideBps: currentLab.commissionOverrideBps,
      },
      afterData: {
        approvalStatus: updatedLab.approvalStatus,
        isSuspended: updatedLab.isSuspended,
        internalNotes: updatedLab.internalNotes,
        commissionOverrideBps: updatedLab.commissionOverrideBps,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, lab: updatedLab });
  } catch (err: any) {
    console.error("PATCH /api/admin/labs/[id] ERROR >>>", err);

    if (err.code === "P2025") {
      return NextResponse.json(
        { error: "Laboratorio no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Error actualizando laboratorio", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar laboratorio
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
    const labId = parseInt(id);

    if (!Number.isFinite(labId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Obtener lab para auditoría
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    // Verificar si tiene pedidos asociados
    const ordersCount = await prisma.printOrder.count({
      where: { labId },
    });

    if (ordersCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar el laboratorio porque tiene ${ordersCount} pedido(s) asociado(s)` },
        { status: 400 }
      );
    }

    // Eliminar laboratorio
    await prisma.lab.delete({
      where: { id: labId },
    });

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "DELETE_LAB",
      entityType: "Lab",
      entityId: labId,
      description: `Laboratorio eliminado: ${lab.name}`,
      beforeData: lab,
      afterData: null,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, message: "Laboratorio eliminado correctamente" });
  } catch (err: any) {
    console.error("DELETE /api/admin/labs/[id] ERROR >>>", err);

    if (err.code === "P2025") {
      return NextResponse.json(
        { error: "Laboratorio no encontrado" },
        { status: 404 }
      );
    }

    if (err.code === "P2003") {
      return NextResponse.json(
        { error: "No se puede eliminar el laboratorio porque tiene relaciones asociadas" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error eliminando laboratorio", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
