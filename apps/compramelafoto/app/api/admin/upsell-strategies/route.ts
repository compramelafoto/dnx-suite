import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/upsell-strategies
 * Lista todas las estrategias de upsell (solo admin). Para gestión en panel admin.
 */
export async function GET() {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado." }, { status: 401 });
    }

    const strategies = await prisma.upsellStrategy.findMany({
      orderBy: { slug: "asc" },
    });

    return NextResponse.json({ strategies });
  } catch (e) {
    console.error("GET /api/admin/upsell-strategies ERROR >>>", e);
    return NextResponse.json(
      { error: "Error al cargar estrategias de upsell." },
      { status: 500 }
    );
  }
}
