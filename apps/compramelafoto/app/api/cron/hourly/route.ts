import { NextRequest, NextResponse } from "next/server";
import { runSendAlbumNotifications } from "@/lib/cron/send-album-notifications";
import { runAlbumInterestDigest } from "@/lib/cron/album-interest-digest";
import { runReencolarConfirmacionesPedido } from "@/lib/cron/reencolar-confirmaciones-pedido";
import { runControlarPacksConUnidades } from "@/lib/cron/controlar-packs-con-unidades";
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
 * - Comprobantes de pedido que no llegaron a la cola (pedidos pagados de los últimos 3 días)
 * - Packs de preventa sin canjear con menos unidades de las que se pagaron (aviso al admin)
 *
 * Protegido: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const started = Date.now();
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";

  const [albumNotifications, albumInterest, orderConfirmations, packsConUnidades] = await Promise.all([
    runSendAlbumNotifications({ dryRun }),
    runAlbumInterestDigest({ dryRun }),
    runReencolarConfirmacionesPedido({ dryRun }),
    // Un control que falla no puede frenar los envíos de la hora.
    runControlarPacksConUnidades({ dryRun }).catch((err) => {
      console.error("[cron:hourly] controlar-packs-con-unidades", err);
      return null;
    }),
  ]);

  const jobsOk =
    (albumNotifications.total ?? 0) +
    (albumInterest.sent ?? 0) +
    orderConfirmations.reencolados;
  const jobsFailed =
    (albumNotifications.failed ?? 0) +
    (albumInterest.failed ?? 0) +
    orderConfirmations.fallidos;
  const idle = jobsOk === 0 && jobsFailed === 0;

  const summary = {
    ok: true,
    dryRun,
    albumNotifications,
    albumInterest,
    orderConfirmations,
    packsConUnidades,
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
