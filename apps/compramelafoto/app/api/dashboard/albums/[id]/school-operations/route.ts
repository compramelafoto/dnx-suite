import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  loadSchoolOperationsOrders,
  parseSchoolOperationsFilters,
} from "@/lib/dashboard/album-school-operations/school-operations-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/school-operations
 * Pedidos de preventa del álbum (solo operador dueño del álbum), con filtros locales al álbum.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(context.params);
    const albumId = parseInt(id, 10);
    if (!Number.isInteger(albumId) || albumId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const filters = parseSchoolOperationsFilters(new URL(req.url).searchParams);
    const result = await loadSchoolOperationsOrders(albumId, user.id, filters);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ orders: result.orders, total: result.orders.length });
  } catch (e) {
    console.error("GET /api/dashboard/albums/[id]/school-operations:", e);
    return NextResponse.json({ error: "Error al cargar operaciones" }, { status: 500 });
  }
}
