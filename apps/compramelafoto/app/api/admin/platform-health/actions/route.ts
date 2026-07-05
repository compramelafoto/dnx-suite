import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { runAlbumCleanupCron } from "@/lib/album-cleanup/process-batch";
import { runExifDeviceScanJob } from "@/lib/photographic-equipment/run-exif-device-scan";
import { countPendingZipJobs, getNextPendingJobs } from "@/lib/zip-job-queue";
import { generateZipForJob } from "@/lib/zip-generation";
import { getPhotosUploadedTotal } from "@/lib/platform-metrics";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ActionId = "cleanup" | "exif" | "zip" | "ftp" | "recalc-stats";

const ALLOWED: ActionId[] = ["cleanup", "exif", "zip", "ftp", "recalc-stats"];

/**
 * POST /api/admin/platform-health/actions
 * Body: { action: "cleanup" | "exif" | "zip" | "ftp" | "recalc-stats" }
 */
export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const action = body.action as ActionId;
  if (!action || !ALLOWED.includes(action)) {
    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  }

  try {
    switch (action) {
      case "cleanup": {
        const result = await runAlbumCleanupCron();
        return NextResponse.json({
          ok: true,
          action,
          message: "Limpieza de álbumes ejecutada.",
          result,
        });
      }
      case "exif": {
        const result = await runExifDeviceScanJob({
          ignoreWindow: true,
          ignoreEnabledFlag: true,
          holderPrefix: `platform-health:${user.id}`,
        });
        return NextResponse.json({
          ok: true,
          action,
          message:
            result.processed > 0
              ? `EXIF: ${result.processed} fotos procesadas (${result.pendingRemaining} pendientes).`
              : result.skippedReason ?? "No había fotos EXIF pendientes.",
          result,
        });
      }
      case "zip": {
        const pending = await countPendingZipJobs();
        if (pending === 0) {
          return NextResponse.json({
            ok: true,
            action,
            message: "No hay ZIPs pendientes.",
            result: { pending: 0, processed: [] },
          });
        }
        const jobs = await getNextPendingJobs(1);
        const processed: string[] = [];
        const failed: string[] = [];
        for (const job of jobs) {
          try {
            await generateZipForJob(job.id);
            processed.push(job.id);
          } catch {
            failed.push(job.id);
          }
        }
        return NextResponse.json({
          ok: true,
          action,
          message: `ZIP: ${processed.length} procesado(s), ${failed.length} fallido(s).`,
          result: { pending, processed, failed },
        });
      }
      case "ftp": {
        const { runCameraIngestBatch } = await import(
          "@/lib/camera-connection/process-camera-ingest-job"
        );
        const { getCameraIngestRunConfigFromEnv } = await import(
          "@/lib/camera-connection/camera-ingest-run-config"
        );
        const config = getCameraIngestRunConfigFromEnv();
        const result = await runCameraIngestBatch(config);
        return NextResponse.json({
          ok: true,
          action,
          message:
            result.claimed === 0
              ? "No había trabajos de ingesta pendientes."
              : `FTP/ingesta: ${result.completed} de ${result.claimed} job(s) completados.`,
          result,
        });
      }
      case "recalc-stats": {
        const total = await getPhotosUploadedTotal();
        const active = await prisma.photo.count({
          where: { storageCleanupStatus: "ACTIVE", isRemoved: false },
        });
        return NextResponse.json({
          ok: true,
          action,
          message: `Estadísticas recalculadas: ${total.toLocaleString("es-AR")} fotos históricas.`,
          result: { photosUploadedTotal: total, activePhotosInDb: active },
        });
      }
      default:
        return NextResponse.json({ error: "Acción no implementada" }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error("[platform-health/actions]", action, err);
    return NextResponse.json(
      {
        ok: false,
        action,
        error: err instanceof Error ? err.message : "Error al ejecutar acción",
      },
      { status: 500 }
    );
  }
}
