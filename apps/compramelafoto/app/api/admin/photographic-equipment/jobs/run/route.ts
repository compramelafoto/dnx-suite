import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { forceReleaseExifDeviceScanLease } from "@/lib/photographic-equipment/scan-lease";
import { clearExifDeviceScanLockOnState } from "@/lib/photographic-equipment/scan-state";
import {
  runExifDeviceScanJob,
  runExifDeviceScanMultiBatch,
} from "@/lib/photographic-equipment/run-exif-device-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/photographic-equipment/jobs/run?mode=now|multi
 * - now (default): un lote manual, ignora ventana horaria
 * - multi: hasta 5 lotes seguidos
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
    }

    const modeParam = req.nextUrl.searchParams.get("mode");
    const isMulti = modeParam === "multi" || modeParam === "drain";
    const holderPrefix = `admin:${user.id}`;

    if (isMulti) {
      const multi = await runExifDeviceScanMultiBatch(5, {
        ignoreWindow: true,
        ignoreEnabledFlag: true,
        holderPrefix,
      });

      const message =
        multi.totals.processed === 0
          ? multi.messages[0] === "LOCK_BUSY"
            ? "Hay un escaneo en curso. Esperá o liberá el bloqueo."
            : "No había fotos pendientes de escaneo EXIF."
          : `Procesados ${multi.totals.processed} fotos en ${multi.batchesRun} lote(s). Quedan ${multi.pendingRemaining.toLocaleString("es-AR")} pendientes.`;

      console.info("[exif-device-scan:admin-multi]", {
        adminUserId: user.id,
        ...multi,
      });

      return NextResponse.json({
        ok: true,
        mode: "multi",
        batches: multi.batchesRun,
        processed: multi.totals.processed,
        analyzed: multi.totals.analyzed,
        noExif: multi.totals.noExif,
        failed: multi.totals.failed,
        pendingRemaining: multi.pendingRemaining,
        scanMode: multi.mode,
        isBackfillComplete: multi.isBackfillComplete,
        durationMs: multi.durationMs,
        messages: multi.messages,
        message,
      });
    }

    const result = await runExifDeviceScanJob({
      ignoreWindow: true,
      ignoreEnabledFlag: true,
      holderPrefix,
    });

    if (result.skipped && result.skippedReason === "LOCK_BUSY") {
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: "another_process_running",
        message:
          "Hay un escaneo EXIF en curso o un bloqueo reciente. Esperá unos minutos o usá «Liberar bloqueo».",
      });
    }

    const message =
      result.processed === 0
        ? result.skippedReason === "IDLE"
          ? "No había fotos pendientes de escaneo EXIF."
          : result.skippedReason === "SKIPPED_OUTSIDE_WINDOW"
            ? "Fuera de la ventana diaria (02:00–05:00 AR)."
            : "No se procesaron fotos en este lote."
        : `Procesadas ${result.processed} fotos (${result.analyzed} con equipo detectado). Quedan ${result.pendingRemaining.toLocaleString("es-AR")} pendientes.`;

    console.info("[exif-device-scan:admin-run]", {
      adminUserId: user.id,
      ...result,
    });

    return NextResponse.json({
      ok: true,
      mode: "now",
      scanMode: result.mode,
      isBackfillComplete: result.isBackfillComplete,
      processed: result.processed,
      analyzed: result.analyzed,
      withExif: result.analyzed,
      noExif: result.noExif,
      failed: result.failed,
      pendingRemaining: result.pendingRemaining,
      durationMs: result.durationMs,
      batchSize: result.batchSize,
      skipped: result.skipped,
      skippedReason: result.skippedReason,
      message,
    });
  } catch (error: unknown) {
    console.error("POST admin/photographic-equipment/jobs/run ERROR >>>", error);
    return NextResponse.json(
      {
        error: "Error al ejecutar escaneo EXIF",
        detail: String((error as { message?: string })?.message ?? error),
      },
      { status: 500 }
    );
  }
}
