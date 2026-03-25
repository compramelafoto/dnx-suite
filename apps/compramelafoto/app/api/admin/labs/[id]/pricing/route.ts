import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT: Actualizar precios base del laboratorio
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
    const { prices } = body; // Array de { size, unitPrice, currency, isActive }

    if (!Array.isArray(prices)) {
      return NextResponse.json({ error: "prices debe ser un array" }, { status: 400 });
    }

    // Verificar que el lab existe
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { id: true, name: true },
    });

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    // Obtener precios actuales para auditoría
    const currentPrices = await prisma.labBasePrice.findMany({
      where: { labId },
    });

    // Eliminar precios existentes y crear nuevos
    await prisma.labBasePrice.deleteMany({
      where: { labId },
    });

    const newPrices = await Promise.all(
      prices.map((p: any) =>
        prisma.labBasePrice.create({
          data: {
            labId,
            size: p.size,
            unitPrice: p.unitPrice,
            currency: p.currency || "ARS",
            isActive: p.isActive !== false,
          },
        })
      )
    );

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "UPDATE_LAB_PRICING",
      entityType: "Lab",
      entityId: labId,
      description: `Precios base actualizados (${prices.length} tamaños)`,
      beforeData: { prices: currentPrices },
      afterData: { prices: newPrices },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, prices: newPrices });
  } catch (err: any) {
    console.error("PUT /api/admin/labs/[id]/pricing ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando precios", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
