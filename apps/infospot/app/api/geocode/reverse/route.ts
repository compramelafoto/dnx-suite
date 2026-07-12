import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reverseGeocodeCoordinates } from "@/lib/geolocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hits = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 20;
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

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

/** GET /api/geocode/reverse?lat=&lon= — público con rate limit. */
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!allow(ip)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const parsed = schema.safeParse({
    lat: req.nextUrl.searchParams.get("lat"),
    lon: req.nextUrl.searchParams.get("lon"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  try {
    const result = await reverseGeocodeCoordinates(parsed.data.lat, parsed.data.lon);
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Reverse geocode no disponible" }, { status: 502 });
  }
}
