import { NextRequest, NextResponse } from "next/server";
import { revalidatePublicFeedCache } from "@/lib/feed/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint QA para probar invalidación de tags del feed.
 * Solo opera con ALLOW_INFOSPOT_QA_SEED=1.
 */
export async function POST(req: NextRequest) {
  if (process.env.ALLOW_INFOSPOT_QA_SEED !== "1") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const itemId = req.nextUrl.searchParams.get("itemId") || undefined;
  revalidatePublicFeedCache({ itemId: itemId || undefined });
  return NextResponse.json({
    ok: true,
    tags: [
      "infospot-home-feed",
      "infospot-public-content",
      "infospot-home",
      ...(itemId ? [`infospot-feed-item:${itemId}`] : []),
    ],
  });
}
