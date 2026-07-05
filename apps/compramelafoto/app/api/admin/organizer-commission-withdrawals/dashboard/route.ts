/**
 * GET /api/admin/organizer-commission-withdrawals/dashboard
 * Métricas financieras globales (solo lectura).
 */

import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getOrganizerCommissionFinancialDashboard } from "@/lib/admin/organizer-commission-financial-dashboard";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const dashboard = await getOrganizerCommissionFinancialDashboard();
    return NextResponse.json(dashboard);
  } catch (err: unknown) {
    console.error("GET .../dashboard ERROR >>>", err);
    return NextResponse.json(
      { error: "Error cargando métricas", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
