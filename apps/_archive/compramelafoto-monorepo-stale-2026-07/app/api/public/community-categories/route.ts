import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Listado público de categorías de comunidad por tipo (para formularios de alta).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as "PHOTOGRAPHER_SERVICE" | "EVENT_VENDOR" | null;
    if (!type || !["PHOTOGRAPHER_SERVICE", "EVENT_VENDOR"].includes(type)) {
      return NextResponse.json(
        { error: "type debe ser PHOTOGRAPHER_SERVICE o EVENT_VENDOR" },
        { status: 400 }
      );
    }

    const categories = await prisma.communityCategory.findMany({
      where: { type, isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    });

    return NextResponse.json({ categories });
  } catch (err) {
    console.error("GET /api/public/community-categories ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al listar categorías", detail: String((err as Error).message) },
      { status: 500 }
    );
  }
}
