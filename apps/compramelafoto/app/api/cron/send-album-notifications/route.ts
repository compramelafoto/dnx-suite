import { NextRequest, NextResponse } from "next/server";
import { runSendAlbumNotifications } from "@/lib/cron/send-album-notifications";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos (puede tomar tiempo enviar muchos emails)

/**
 * GET /api/cron/send-album-notifications
 * 
 * Envía recordatorios por email para álbumes:
 * 1. Cuando se suben las primeras fotos (notifyWhenReady = false)
 * 2. A 3 semanas antes de eliminación (día 9: 21 días antes)
 * 3. A 2 semanas antes de eliminación (día 16: 14 días antes)
 * 4. A 1 semana antes de eliminación (día 23: 7 días antes)
 * 
 * Protegido: si CRON_SECRET está definido, el request debe enviar
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const result = await runSendAlbumNotifications({ dryRun });
  console.log("[cron:album-notifications]", result);

  return NextResponse.json(result);
}
