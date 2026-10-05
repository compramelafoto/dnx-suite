import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { purgePhotosPendingDeletion } from "@/lib/albums/delete-album-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/purge-deleted-photos
 *
 * Red de seguridad del borrado masivo del panel: termina de borrar los archivos de las
 * fotos que quedaron marcadas si la ejecución en segundo plano (`after`) se cortó.
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const result = await purgePhotosPendingDeletion({
      deadlineMs: Date.now() + (maxDuration - 30) * 1000,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    console.error("[purge-deleted-photos] fatal", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
