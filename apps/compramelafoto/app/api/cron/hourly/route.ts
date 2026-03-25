import { NextRequest, NextResponse } from "next/server";
import { runSendAlbumNotifications } from "@/lib/cron/send-album-notifications";
import { runAlbumInterestDigest } from "@/lib/cron/album-interest-digest";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/hourly
 *
 * Ejecuta las tareas horarias:
 * - Notificaciones de álbum
 * - Emails de interés en álbum (agrupados)
 *
 * Protegido: si CRON_SECRET está definido, el request debe enviar
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";

  const [albumNotifications, albumInterest] = await Promise.all([
    runSendAlbumNotifications({ dryRun }),
    runAlbumInterestDigest({ dryRun }),
  ]);

  const summary = {
    ok: true,
    dryRun,
    albumNotifications,
    albumInterest,
  };

  console.log("[cron:hourly]", summary);
  return NextResponse.json(summary);
}
