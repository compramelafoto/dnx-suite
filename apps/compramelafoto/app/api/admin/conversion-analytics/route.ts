import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeAdminConversionAnalytics } from "@/lib/conversion-analytics/compute-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 90;
const MAX_DAYS = 365;

function parseDays(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : DEFAULT_DAYS;
  if (!Number.isFinite(n) || n < 7) return DEFAULT_DAYS;
  return Math.min(n, MAX_DAYS);
}

/**
 * GET /api/admin/conversion-analytics?days=90
 * Vista global de conversión checkout álbum.
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const days = parseDays(req.nextUrl.searchParams.get("days"));
    const data = await computeAdminConversionAnalytics(prisma, days);

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    console.error("GET /api/admin/conversion-analytics", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
