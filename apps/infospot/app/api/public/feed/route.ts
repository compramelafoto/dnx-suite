import { NextRequest, NextResponse } from "next/server";
import { getPublicFeed, parseFeedSearchParams, toFeedItemDto } from "@/lib/feed/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rate limit naive por IP (ventana 60s) — mismo patrón que /api/geocode. */
const hits = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 60;
const WINDOW_MS = 60_000;

function allow(ip: string): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || now > cur.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= LIMIT) return false;
  cur.count += 1;
  return true;
}

/**
 * GET /api/public/feed
 * Feed unificado público. No loguea coordenadas.
 */
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!allow(ip)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const parsed = parseFeedSearchParams(req.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await getPublicFeed({
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
      types: parsed.data.types,
      radiusKm: parsed.data.radiusKm,
      locationMode: parsed.data.locationMode,
    });

    return NextResponse.json({
      items: result.items.map(toFeedItemDto),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      locationMode: result.locationMode,
      personalized: result.personalized,
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo obtener el feed." },
      { status: 500 },
    );
  }
}
