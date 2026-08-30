import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { getAlbumCleanupConfig } from "@/lib/album-cleanup/config";
import { runAlbumCleanupCron } from "@/lib/album-cleanup/process-batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El corte real de cada corrida lo pone este tope, no ALBUM_CLEANUP_MAX_ALBUMS.
// El pipeline es idempotente: si se corta por tiempo, retoma donde quedó.
export const maxDuration = 800;

const CLEANUP_BUILD_VERSION = "resume-cursor-fix-v3";

/**
 * GET /api/cron/cleanup-expired-albums
 *
 * Pipeline por fases (ver lib/album-cleanup/):
 * - Día 30: isHidden
 * - Día 45+: cleanup PENDING → purga storage/metadata en lotes
 * - Por defecto NO borra filas Photo/Album (ALBUM_CLEANUP_DESTRUCTIVE_DELETE=true para hard delete)
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  console.info(`[album-cleanup] build-check ${CLEANUP_BUILD_VERSION}`);
  const config = getAlbumCleanupConfig();

  try {
    const result = await runAlbumCleanupCron();
    return NextResponse.json({
      version: CLEANUP_BUILD_VERSION,
      destructiveDelete: config.destructiveDelete,
      ...result,
    });
  } catch (err: unknown) {
    console.error("[cleanup-expired-albums] fatal", err);
    return NextResponse.json(
      {
        ok: false,
        version: CLEANUP_BUILD_VERSION,
        destructiveDelete: config.destructiveDelete,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
