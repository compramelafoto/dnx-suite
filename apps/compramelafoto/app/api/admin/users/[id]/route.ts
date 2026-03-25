import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Configuración completa del usuario (solo lectura, para soporte)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const userId = parseInt(id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
        isBlocked: true,
        blockedAt: true,
        blockedReason: true,
        lastLoginAt: true,
        platformCommissionPercentOverride: true,
        address: true,
        city: true,
        province: true,
        country: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        birthDate: true,
        companyName: true,
        companyOwner: true,
        cuit: true,
        companyAddress: true,
        website: true,
        instagram: true,
        tiktok: true,
        facebook: true,
        whatsapp: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        tertiaryColor: true,
        fontColor: true,
        preferredLabId: true,
        profitMarginPercent: true,
        isPublicPageEnabled: true,
        publicPageHandler: true,
        enableAlbumsPage: true,
        enablePrintPage: true,
        showCarnetPrints: true,
        showPolaroidPrints: true,
        defaultDigitalPhotoPrice: true,
        digitalDiscountsEnabled: true,
        digitalDiscount5Plus: true,
        digitalDiscount10Plus: true,
        digitalDiscount20Plus: true,
        mpUserId: true,
        mpConnectedAt: true,
        preferredLab: { select: { id: true, name: true, city: true, province: true } },
        lab: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            province: true,
            country: true,
            latitude: true,
            longitude: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            isPublicPageEnabled: true,
            publicPageHandler: true,
            showCarnetPrints: true,
            showPolaroidPrints: true,
            approvalStatus: true,
            isSuspended: true,
            suspendedReason: true,
            mpUserId: true,
            mpConnectedAt: true,
            radiusKm: true,
            shippingEnabled: true,
            fulfillmentMode: true,
            defaultSlaDays: true,
            soyFotografo: true,
            usePriceForPhotographerOrders: true,
            basePrices: { orderBy: { size: "asc" } },
            discounts: { orderBy: [{ size: "asc" }, { minQty: "asc" }] },
            products: { orderBy: { name: "asc" } },
          },
        },
        products: {
          orderBy: [{ name: "asc" }, { size: "asc" }],
          select: {
            id: true,
            name: true,
            size: true,
            acabado: true,
            retailPrice: true,
            currency: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err: any) {
    console.error("GET /api/admin/users/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo configuración", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar estado de usuario (bloquear/desbloquear)
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
    const userId = parseInt(id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { isBlocked, blockedReason, platformCommissionPercentOverride, role } = body;

    // Obtener usuario actual para auditoría
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isBlocked: true,
        blockedReason: true,
        platformCommissionPercentOverride: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // No permitir bloquearse a sí mismo
    if (userId === user.id && isBlocked) {
      return NextResponse.json(
        { error: "No podés bloquear tu propia cuenta" },
        { status: 400 }
      );
    }

    // No permitir cambiarse el rol a sí mismo (evitar que admin se quite el rol)
    if (userId === user.id && role !== undefined) {
      return NextResponse.json(
        { error: "No podés cambiar tu propio rol" },
        { status: 400 }
      );
    }

    const validRoles: Role[] = [Role.ADMIN, Role.PHOTOGRAPHER, Role.LAB, Role.CUSTOMER, Role.LAB_PHOTOGRAPHER, Role.ORGANIZER];
    if (role !== undefined) {
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: "Rol inválido. Valores permitidos: ADMIN, PHOTOGRAPHER, LAB, CUSTOMER, LAB_PHOTOGRAPHER, ORGANIZER" },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (isBlocked !== undefined) {
      updateData.isBlocked = isBlocked;
      if (isBlocked) {
        updateData.blockedAt = new Date();
        updateData.blockedReason = blockedReason || null;
      } else {
        updateData.blockedAt = null;
        updateData.blockedReason = null;
      }
    }

    if (platformCommissionPercentOverride !== undefined) {
      if (platformCommissionPercentOverride === null || platformCommissionPercentOverride === "") {
        updateData.platformCommissionPercentOverride = null;
      } else {
        const parsed = Number(platformCommissionPercentOverride);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
          return NextResponse.json(
            { error: "platformCommissionPercentOverride debe estar entre 0 y 100 o null" },
            { status: 400 }
          );
        }
        updateData.platformCommissionPercentOverride = Math.round(parsed);
      }
    }

    if (role !== undefined) {
      updateData.role = role;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBlocked: true,
        blockedAt: true,
        blockedReason: true,
        platformCommissionPercentOverride: true,
      },
    });

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    const actionType =
      role !== undefined
        ? "CHANGE_USER_ROLE"
        : isBlocked !== undefined
        ? isBlocked
          ? "BLOCK_USER"
          : "UNBLOCK_USER"
        : "UPDATE_USER_FEE";
    const description =
      role !== undefined
        ? `Rol cambiado de ${currentUser.role} a ${role}`
        : isBlocked
        ? `Usuario bloqueado${blockedReason ? `: ${blockedReason}` : ""}`
        : isBlocked !== undefined
        ? "Usuario desbloqueado"
        : "Fee del fotógrafo actualizado";
    await logAdminAction({
      action: actionType,
      entityType: "User",
      entityId: userId,
      description,
      beforeData: {
        role: currentUser.role,
        isBlocked: currentUser.isBlocked,
        blockedReason: currentUser.blockedReason,
        platformCommissionPercentOverride: currentUser.platformCommissionPercentOverride,
      },
      afterData: {
        role: updatedUser.role,
        isBlocked: updatedUser.isBlocked,
        blockedReason: updatedUser.blockedReason,
        platformCommissionPercentOverride: updatedUser.platformCommissionPercentOverride,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    console.error("PATCH /api/admin/users/[id] ERROR >>>", err);

    if (err.code === "P2025") {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Error actualizando usuario", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar usuario (fotógrafo)
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
    const userId = parseInt(id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // No permitir eliminarse a sí mismo
    if (userId === user.id) {
      return NextResponse.json(
        { error: "No podés eliminar tu propia cuenta" },
        { status: 400 }
      );
    }

    // Obtener usuario para auditoría
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!userToDelete) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // No permitir eliminar usuarios asociados a laboratorios
    const lab = await prisma.lab.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (lab) {
      return NextResponse.json(
        { error: "No se puede eliminar el usuario porque está asociado a un laboratorio" },
        { status: 400 }
      );
    }

    // Verificar si tiene álbumes o pedidos asociados como fotógrafo
    const [albumsCount, ordersCount, invitationsCount, removalRequestsAsPhotographer] = await Promise.all([
      prisma.album.count({ where: { userId } }),
      prisma.printOrder.count({ where: { photographerId: userId } }),
      prisma.albumInvitation.count({ where: { invitedByUserId: userId } }),
      prisma.removalRequest.count({ where: { photographerId: userId } }),
    ]);

    if (albumsCount > 0 || ordersCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar el usuario porque tiene ${albumsCount} álbum(es) y ${ordersCount} pedido(s) asociado(s)` },
        { status: 400 }
      );
    }
    if (invitationsCount > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar el usuario porque tiene invitaciones a álbumes enviadas" },
        { status: 400 }
      );
    }
    if (removalRequestsAsPhotographer > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar el usuario porque tiene solicitudes de remoción asociadas como fotógrafo" },
        { status: 400 }
      );
    }

    // Desvincular referencias opcionales, eliminar filas que bloquean el FK, luego eliminar usuario
    await prisma.$transaction([
      prisma.printOrder.updateMany({
        where: { clientId: userId },
        data: { clientId: null },
      }),
      prisma.albumAccess.deleteMany({ where: { userId } }),
      prisma.albumInvitation.updateMany({
        where: { acceptedByUserId: userId },
        data: { acceptedByUserId: null },
      }),
      prisma.supportTicket.updateMany({
        where: { assignedToId: userId },
        data: { assignedToId: null },
      }),
      prisma.removalRequest.updateMany({
        where: { decidedByUserId: userId },
        data: { decidedByUserId: null },
      }),
      prisma.albumExtension.updateMany({
        where: { requestedByUserId: userId },
        data: { requestedByUserId: null },
      }),
      prisma.contactMessage.updateMany({
        where: { photographerId: userId },
        data: { photographerId: null },
      }),
      prisma.printOrderStatusHistory.updateMany({
        where: { changedByUserId: userId },
        data: { changedByUserId: null },
      }),
      prisma.photo.updateMany({
        where: { userId: userId },
        data: { userId: null },
      }),
      prisma.supportMessage.updateMany({
        where: { authorId: userId },
        data: { authorId: null },
      }),
      prisma.adminMessage.updateMany({
        where: { senderId: userId },
        data: { senderId: null },
      }),
      prisma.adminLog.deleteMany({ where: { actorId: userId } }),
      prisma.adminMessageThread.deleteMany({ where: { participantUserId: userId } }),
      prisma.$executeRaw`DELETE FROM "User" WHERE id = ${userId}`,
    ]);

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "DELETE_USER",
      entityType: "User",
      entityId: userId,
      description: `Usuario eliminado: ${userToDelete.email} (${userToDelete.role})`,
      beforeData: userToDelete,
      afterData: null,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, message: "Usuario eliminado correctamente" });
  } catch (err: any) {
    console.error("DELETE /api/admin/users/[id] ERROR >>>", err);

    if (err.code === "P2025") {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (err.code === "P2003") {
      const detail = err?.meta?.field_name
        ? `Relación: ${err.meta.field_name}`
        : err?.message ?? "Tiene datos asociados (álbumes, pedidos, invitaciones, etc.)";
      return NextResponse.json(
        { error: "No se puede eliminar el usuario porque tiene relaciones asociadas", detail },
        { status: 400 }
      );
    }

    const detail = err?.message ?? (typeof err === "string" ? err : "Error desconocido");
    const meta = err?.meta ? JSON.stringify(err.meta) : undefined;
    return NextResponse.json(
      { error: "Error eliminando usuario", detail: String(detail), ...(meta && { meta }) },
      { status: 500 }
    );
  }
}
