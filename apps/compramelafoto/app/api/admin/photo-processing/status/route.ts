import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { loadPhotoProcessingDashboardSnapshot } from "@/lib/admin/photo-processing-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/photo-processing/status
 * Resumen de colas de ingesta (subida) y análisis IA.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    const snapshot = await loadPhotoProcessingDashboardSnapshot();
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (error: unknown) {
    console.error("GET admin/photo-processing/status ERROR >>>", error);
    return NextResponse.json(
      {
        error: "Error al obtener estado de procesamiento",
        detail: String((error as { message?: string })?.message ?? error),
      },
      { status: 500 }
    );
  }
}
