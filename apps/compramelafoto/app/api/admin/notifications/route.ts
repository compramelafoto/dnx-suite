import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getAppConfig } from "@/lib/services/settingsService";
import { getAdminDashboardAlerts } from "@/lib/admin/admin-dashboard-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    let config: { stuckOrderDays?: number } = {};
    try {
      config = (await getAppConfig()) ?? {};
    } catch {
      config = {};
    }

    const items = await getAdminDashboardAlerts(prisma, config);
    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("GET /api/admin/notifications", err);
    return NextResponse.json(
      { error: err?.message ?? "Error obteniendo notificaciones" },
      { status: 500 }
    );
  }
}
