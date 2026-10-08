import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { logLegacyPreventaUsage } from "@/lib/observability/legacy-preventa-usage";
import { legacyTemplateListWhereForRole } from "@/lib/dashboard/legacy-template-list-where";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/precompra-products/[productId]/templates
 * Lista plantillas del producto.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseInt((await params).id, 10);
    const productId = parseInt((await params).productId, 10);
    if (!Number.isInteger(albumId) || !Number.isInteger(productId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const product = await prisma.albumProduct.findFirst({
      where: { id: productId, albumId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    logLegacyPreventaUsage({
      source: "legacy_precompra_products",
      route: req.nextUrl.pathname,
      method: "GET",
      albumId,
    });

    const visibility = legacyTemplateListWhereForRole(user.role);
    const templates = await prisma.template.findMany({
      where: { albumProductId: productId, ...(visibility ?? {}) },
      include: { slots: { orderBy: { index: "asc" } } },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ templates });
  } catch (e) {
    console.error("templates GET error:", e);
    return NextResponse.json({ error: "Error al listar plantillas" }, { status: 500 });
  }
}

/**
 * POST retirado: el diseñador viejo ya no crea plantillas. Todo el circuito de diseño usa el
 * diseñador nuevo (`TemplateV2`); ver docs/compramelafoto/DISENO-V2-SELECCION-Y-APROBACION.md.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "El diseñador viejo se retiró. Creá la plantilla en el diseñador nuevo (Diseños → Mis plantillas).",
    },
    { status: 410 }
  );
}

