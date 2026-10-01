import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { runVideoCleanup } from "@/lib/videos/video-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/cleanup-expired-videos
 *
 * Borra de R2 los videos que pasaron sus 15 días de publicación y los que el
 * fotógrafo eliminó. Hasta que existió esta tarea, ningún video se borraba
 * nunca: los 19 de producción ocupaban 1,27 GB que ya debían estar liberados.
 *
 * `?dryRun=1` informa qué borraría sin tocar nada.
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const maxParam = Number(req.nextUrl.searchParams.get("max") ?? "");
  const maxVideos = Number.isFinite(maxParam) && maxParam > 0 ? maxParam : undefined;

  try {
    const result = await runVideoCleanup(prisma, { dryRun, maxVideos });
    return NextResponse.json({ dryRun, ...result });
  } catch (err: unknown) {
    console.error("[cleanup-expired-videos] fatal", err);
    return NextResponse.json(
      {
        ok: false,
        dryRun,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
