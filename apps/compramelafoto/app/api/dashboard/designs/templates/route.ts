import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { listDesignDashboardTemplateGroups } from "@/lib/dashboard/list-design-dashboard-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/designs/templates
 * Respuesta: `systemTemplates` (meta sistema + v2 + PUBLIC APPROVED), `userTemplates` (dueña, no sistema, meta v2),
 * y si `ADMIN`: `adminAllTemplates` (todas las Template V2 con meta diseño v2). Solo tabla `templateV2`.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const data = await listDesignDashboardTemplateGroups({ userId: user.id, role: user.role });
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    console.error("GET /api/dashboard/designs/templates error:", e);
    return NextResponse.json({ ok: false, error: "Error al listar plantillas" }, { status: 500 });
  }
}
