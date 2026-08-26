import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { suspendOldPendingAnalysis } from "@/lib/analysis/suspend-old-pending";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/ai/suspend-old-pending?days=7
 *
 * Suspende (excluye del cron) fotos PENDING/PROCESSING subidas hace más de N días
 * para priorizar álbumes recientes.
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol ADMIN." },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const daysRaw = Number(url.searchParams.get("days") || "7");
    const days = Number.isFinite(daysRaw)
      ? Math.min(3650, Math.max(1, Math.floor(daysRaw)))
      : 7;

    const result = await suspendOldPendingAnalysis(days);
    return NextResponse.json({
      ok: true,
      ...result,
      note: "Las fotos nuevas o de los últimos N días siguen en cola. Podés reactivar antiguas con reprocess por álbum.",
    });
  } catch (error: any) {
    console.error("Error en suspend-old-pending:", error);
    return NextResponse.json(
      { error: "Error al suspender pendientes antiguas", detail: error?.message },
      { status: 500 }
    );
  }
}
