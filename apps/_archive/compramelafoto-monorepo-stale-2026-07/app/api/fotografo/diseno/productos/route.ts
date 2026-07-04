import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/fotografo/diseno/productos
 * Lista álbumes del fotógrafo con sus productos que requieren diseño (requiresDesign),
 * para elegir en qué producto crear plantillas.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumsRaw = await prisma.album.findMany({
      where: { userId: user.id, deletedAt: null },
      select: {
        id: true,
        title: true,
        preCompraProducts: {
          where: { requiresDesign: true },
          select: {
            id: true,
            name: true,
            requiresDesign: true,
            _count: { select: { templates: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const albums = albumsRaw.map((a) => ({
      id: a.id,
      title: a.title,
      albumProducts: a.preCompraProducts,
    }));
    return NextResponse.json({ albums });
  } catch (e) {
    console.error("fotografo/diseno/productos GET error:", e);
    return NextResponse.json({ error: "Error al listar" }, { status: 500 });
  }
}
