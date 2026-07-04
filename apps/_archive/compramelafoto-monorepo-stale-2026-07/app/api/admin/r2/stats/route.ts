import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getR2BucketStats } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Precio aproximado R2 Standard: ~$0.015/GB-mes */
const R2_COST_PER_GB_MONTH = 0.015;

export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const stats = await getR2BucketStats({ maxMs: 25_000 });

    const totalGb = stats.totalBytes / (1024 * 1024 * 1024);
    const estimatedCostPerMonth = totalGb * R2_COST_PER_GB_MONTH;

    return NextResponse.json({
      objectCount: stats.objectCount,
      totalBytes: stats.totalBytes,
      totalGb: Math.round(totalGb * 1000) / 1000,
      estimatedCostPerMonthUsd: Math.round(estimatedCostPerMonth * 1000) / 1000,
      isTruncated: stats.isTruncated,
      error: stats.error ?? null,
    });
  } catch (err) {
    console.error("[admin/r2/stats]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener estadísticas" },
      { status: 500 }
    );
  }
}
