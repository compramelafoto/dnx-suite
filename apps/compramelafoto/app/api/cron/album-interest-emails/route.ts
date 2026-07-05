import { NextRequest, NextResponse } from "next/server";
import { runAlbumInterestDigest } from "@/lib/cron/album-interest-digest";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const result = await runAlbumInterestDigest({ dryRun });
  console.log("[cron:album-interest]", result);

  return NextResponse.json(result);
}
