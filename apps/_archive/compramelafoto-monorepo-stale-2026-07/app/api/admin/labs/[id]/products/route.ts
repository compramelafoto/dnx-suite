import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT: Actualizar productos del laboratorio
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
    const { products } = body; // Array de { name, size?, photographerPrice, retailPrice, currency, isActive }

    if (!Array.isArray(products)) {
      return NextResponse.json({ error: "products debe ser un array" }, { status: 400 });
    }

    // Verificar que el lab existe
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { id: true, name: true },
    });

    if (!lab) {
      return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
    }

    // Obtener productos actuales para auditoría
    const currentProducts = await prisma.labProduct.findMany({
      where: { labId },
    });

    // Eliminar productos existentes y crear nuevos
    await prisma.labProduct.deleteMany({
      where: { labId },
    });

    const newProducts = await Promise.all(
      products.map((p: any) =>
        prisma.labProduct.create({
          data: {
            labId,
            name: p.name,
            size: p.size || null,
            photographerPrice: p.photographerPrice,
            retailPrice: p.retailPrice,
            currency: p.currency || "ARS",
            isActive: p.isActive !== false,
          },
        })
      )
    );

    // Registrar auditoría
    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "UPDATE_LAB_PRODUCTS",
      entityType: "Lab",
      entityId: labId,
      description: `Productos actualizados (${products.length} productos)`,
      beforeData: { products: currentProducts },
      afterData: { products: newProducts },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, products: newProducts });
  } catch (err: any) {
    console.error("PUT /api/admin/labs/[id]/products ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando productos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
