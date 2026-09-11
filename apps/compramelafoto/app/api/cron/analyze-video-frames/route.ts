import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { analyzePendingVideoFrames } from "@/lib/videos/video-frame-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/analyze-video-frames
 *
 * Indexa en Rekognition los fotogramas que extrajo el worker de video, para que
 * el cliente pueda encontrarse en un video con la misma selfie con la que se
 * busca en las fotos.
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const maxParam = Number(req.nextUrl.searchParams.get("max") ?? "");
  const max = Number.isFinite(maxParam) && maxParam > 0 ? maxParam : undefined;

  try {
    const result = await analyzePendingVideoFrames(prisma, { max });
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[analyze-video-frames] fatal", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
