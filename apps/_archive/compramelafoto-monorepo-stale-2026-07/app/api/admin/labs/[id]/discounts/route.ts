import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT: Actualizar descuentos del laboratorio
export async function PUT(
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
    const { discounts } = body; // Array de { size, minQty, discountPercent, isActive }

    if (!Array.isArray(discounts)) {
      return NextResponse.json({ error: "discounts debe ser un array" }, { status: 400 });
    }

    // Verificar que el lab existe
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { id: true, name: true },
    });

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    // Obtener descuentos actuales para auditoría
    const currentDiscounts = await prisma.labSizeDiscount.findMany({
      where: { labId },
    });

    // Eliminar descuentos existentes y crear nuevos
    await prisma.labSizeDiscount.deleteMany({
      where: { labId },
    });

    const newDiscounts = await Promise.all(
      discounts.map((d: any) =>
        prisma.labSizeDiscount.create({
          data: {
            labId,
            size: d.size,
            minQty: d.minQty,
            discountPercent: d.discountPercent,
            isActive: d.isActive !== false,
          },
        })
      )
    );

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "UPDATE_LAB_DISCOUNTS",
      entityType: "Lab",
      entityId: labId,
      description: `Descuentos actualizados (${discounts.length} reglas)`,
      beforeData: { discounts: currentDiscounts },
      afterData: { discounts: newDiscounts },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, discounts: newDiscounts });
  } catch (err: any) {
    console.error("PUT /api/admin/labs/[id]/discounts ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando descuentos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
