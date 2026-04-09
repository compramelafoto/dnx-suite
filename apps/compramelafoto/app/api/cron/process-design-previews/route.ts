import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { processOneDesignPreviewJob } from "@/lib/school-design/process-preview-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET — Procesa un job de preview (repetir en cron cada minuto o similar).
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    let count = 0;
    for (let i = 0; i < 15; i++) {
      const ran = await processOneDesignPreviewJob();
      if (!ran) break;
      count++;
    }
    return NextResponse.json({ ok: true, processedCount: count });
  } catch (e) {
    console.error("[cron] process-design-previews", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
