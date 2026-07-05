import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, urlToR2Key } from "@/lib/r2-client";
import { assertCronAuth } from "@/lib/cron-auth";
import { logCronMetrics } from "@/lib/cron-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const started = Date.now();

  try {
    const now = new Date();
    const expired = await prisma.printOrderItem.findMany({
      where: {
        printExpiresAt: { lt: now },
        fileKey: { not: "" },
      },
      select: { id: true, fileKey: true },
      take: 200,
    });

    let deleted = 0;
    for (const item of expired) {
      const r2Key = urlToR2Key(item.fileKey);
      if (r2Key.startsWith("prints/carnet/") || r2Key.startsWith("prints/polaroids/")) {
        await deleteFromR2(r2Key).catch(() => {});
        deleted += 1;
      }
      await prisma.printOrderItem.update({
        where: { id: item.id },
        data: { printExpiresAt: null },
      });
    }

    logCronMetrics({
      cron: "cleanup-expired-prints",
      duration_ms: Date.now() - started,
      jobs_claimed: expired.length,
      jobs_ok: deleted,
      jobs_failed: 0,
      images_processed: deleted,
      idle: expired.length === 0,
    });

    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("CLEANUP EXPIRED PRINTS ERROR >>>", err);
    logCronMetrics({
      cron: "cleanup-expired-prints",
      duration_ms: Date.now() - started,
      jobs_claimed: 0,
      jobs_ok: 0,
      jobs_failed: 1,
      idle: false,
      error: msg,
    });
    return NextResponse.json(
      { error: "Error limpiando impresiones vencidas", detail: msg },
      { status: 500 }
    );
  }
}
