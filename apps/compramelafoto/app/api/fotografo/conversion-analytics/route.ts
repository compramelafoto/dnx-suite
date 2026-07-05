import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePhotographerConversionAnalytics } from "@/lib/conversion-analytics/compute-metrics";

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
 * GET /api/fotografo/conversion-analytics?days=90
 * Métricas de conversión checkout álbum (scoped al fotógrafo).
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const days = parseDays(req.nextUrl.searchParams.get("days"));
    const data = await computePhotographerConversionAnalytics(prisma, user.id, days);

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    console.error("GET /api/fotografo/conversion-analytics", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
