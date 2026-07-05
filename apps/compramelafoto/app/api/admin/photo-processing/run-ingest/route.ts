import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getCameraIngestRunConfigFromEnv } from "@/lib/camera-connection/camera-ingest-run-config";
import {
  runCameraIngestBatch,
  runCameraIngestDrain,
} from "@/lib/camera-connection/process-camera-ingest-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/photo-processing/run-ingest?mode=drain
 * Procesa CameraIngestJob: un lote (default) o drenaje continuo (mode=drain).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    const config = getCameraIngestRunConfigFromEnv();
    const mode = req.nextUrl.searchParams.get("mode");

    if (mode === "drain") {
      const result = await runCameraIngestDrain(config, { maxDurationMs: 270_000 });
      return NextResponse.json({
        ok: true,
        mode: "drain",
        message:
          result.totalClaimed === 0
            ? "No había trabajos de ingesta pendientes."
            : `Procesadas ${result.totalCompleted} de ${result.totalClaimed} en ${Math.round(result.elapsedMs / 1000)}s (${result.batches} lotes).`,
        ...result,
      });
    }

    const result = await runCameraIngestBatch(config);
    return NextResponse.json({
      ok: true,
      mode: "batch",
      message:
        result.claimed === 0
          ? "No había trabajos de ingesta pendientes."
          : `Procesadas ${result.completed} de ${result.claimed} trabajos (${result.failed} con error).`,
      ...result,
    });
  } catch (error: unknown) {
    console.error("POST admin/photo-processing/run-ingest ERROR >>>", error);
    return NextResponse.json(
      {
        error: "Error al procesar cola de ingesta",
        detail: String((error as { message?: string })?.message ?? error),
      },
      { status: 500 }
    );
  }
}
