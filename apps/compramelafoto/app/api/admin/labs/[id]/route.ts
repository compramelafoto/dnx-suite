import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role, LabApprovalStatus, LabType } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Obtener detalle de un laboratorio
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  { params }: { params: Promise<{ id: string }> }
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
        email: true,
        phone: true,
        address: true,
        city: true,
        province: true,
        country: true,
        labType: true,
        logoUrl: true,
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

    // Datos de la ficha (nombre, contacto, ubicación, tipo y logo)
    const textoOpcional = (v: unknown) => {
      const s = typeof v === "string" ? v.trim() : "";
      return s === "" ? null : s;
    };
    const editaFicha = ["name", "email", "phone", "address", "city", "province", "country", "labType", "logoUrl"].some(
      (k) => body[k] !== undefined
    );

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
      }
      updateData.name = name;
    }
    if (body.email !== undefined) {
      const email = textoOpcional(body.email)?.toLowerCase() ?? null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "El email no es válido" }, { status: 400 });
      }
      if (email && email !== currentLab.email) {
        const otro = await prisma.lab.findFirst({
          where: { email: { equals: email, mode: "insensitive" }, NOT: { id: labId } },
          select: { id: true, name: true },
        });
        if (otro) {
          return NextResponse.json(
            { error: `Ese email ya lo usa otro laboratorio (#${otro.id} ${otro.name})` },
            { status: 400 }
          );
        }
      }
      updateData.email = email;
    }
    for (const campo of ["phone", "address", "city", "province", "country", "logoUrl"] as const) {
      if (body[campo] !== undefined) updateData[campo] = textoOpcional(body[campo]);
    }
    if (body.labType !== undefined) {
      if (!Object.values(LabType).includes(body.labType)) {
        return NextResponse.json({ error: "Tipo de laboratorio inválido" }, { status: 400 });
      }
      updateData.labType = body.labType as LabType;
    }

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
    if (editaFicha) {
      actionDesc = `Datos del laboratorio editados: ${updatedLab.name}`;
    } else if (approvalStatus) {
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
        editaFicha
          ? "UPDATE_LAB"
          : approvalStatus
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
        name: currentLab.name,
        email: currentLab.email,
        phone: currentLab.phone,
        address: currentLab.address,
        city: currentLab.city,
        province: currentLab.province,
        country: currentLab.country,
        labType: currentLab.labType,
        logoUrl: currentLab.logoUrl,
        approvalStatus: currentLab.approvalStatus,
        isSuspended: currentLab.isSuspended,
        internalNotes: currentLab.internalNotes,
        commissionOverrideBps: currentLab.commissionOverrideBps,
      },
      afterData: {
        name: updatedLab.name,
        email: updatedLab.email,
        phone: updatedLab.phone,
        address: updatedLab.address,
        city: updatedLab.city,
        province: updatedLab.province,
        country: updatedLab.country,
        labType: updatedLab.labType,
        logoUrl: updatedLab.logoUrl,
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
  { params }: { params: Promise<{ id: string }> }
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
