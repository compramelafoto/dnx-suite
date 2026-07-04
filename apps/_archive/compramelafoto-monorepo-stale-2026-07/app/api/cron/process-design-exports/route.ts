import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { processOneDesignExportJob } from "@/lib/school-design/process-export-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET — Procesa un job de export JPG.
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  try {
    let count = 0;
    for (let i = 0; i < 15; i++) {
      const ran = await processOneDesignExportJob();
      if (!ran) break;
      count++;
    }
    return NextResponse.json({ ok: true, processedCount: count });
  } catch (e) {
    console.error("[cron] process-design-exports", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
