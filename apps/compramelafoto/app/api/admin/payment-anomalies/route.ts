/**
 * GET /api/admin/payment-anomalies
 * Últimos eventos de auditoría relacionados con MP, canje preventa y reconciliación.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { MP_PAYMENT_ANOMALY_AUDIT_EVENT_TYPES } from "@/lib/mp-payment-anomaly-audit-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "80", 10) || 80, 1), 200);

    const logs = await prisma.orderAuditLog.findMany({
      where: {
        eventType: { in: [...MP_PAYMENT_ANOMALY_AUDIT_EVENT_TYPES] },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      logs,
      eventTypes: MP_PAYMENT_ANOMALY_AUDIT_EVENT_TYPES,
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/payment-anomalies", err);
    return NextResponse.json(
      {
        error: "Error obteniendo anomalías de pago",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
