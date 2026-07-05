import { NextRequest, NextResponse } from "next/server";
import { runSendAlbumNotifications } from "@/lib/cron/send-album-notifications";
import { runAlbumInterestDigest } from "@/lib/cron/album-interest-digest";
import { assertCronAuth } from "@/lib/cron-auth";
import { logCronMetrics } from "@/lib/cron-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/hourly
 *
 * Tareas programadas cada hora (vercel.json: `0 * * * *`):
 * - Notificaciones de álbum (solo pendientes reales, con límite por sección)
 * - Emails de interés en álbum (digest agrupado, límite batch)
 *
 * Protegido: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const started = Date.now();
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";

  const [albumNotifications, albumInterest] = await Promise.all([
    runSendAlbumNotifications({ dryRun }),
    runAlbumInterestDigest({ dryRun }),
  ]);

  const jobsOk =
    (albumNotifications.total ?? 0) + (albumInterest.sent ?? 0);
  const jobsFailed =
    (albumNotifications.failed ?? 0) + (albumInterest.failed ?? 0);
  const idle = jobsOk === 0 && jobsFailed === 0;

  const summary = {
    ok: true,
    dryRun,
    albumNotifications,
    albumInterest,
  };

  logCronMetrics({
    cron: "hourly",
    duration_ms: Date.now() - started,
    jobs_claimed:
      (albumNotifications.total ?? 0) +
      (albumInterest.interestsDue ?? 0) +
      (albumNotifications.skipped ?? 0),
    jobs_ok: jobsOk,
    jobs_failed: jobsFailed,
    images_processed: 0,
    idle,
    dry_run: dryRun,
  });

  console.log("[cron:hourly]", summary);
  return NextResponse.json(summary);
}
