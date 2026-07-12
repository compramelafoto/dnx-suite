import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchEventLocations } from "@/lib/geolocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rate limit naive por IP (ventana 60s). */
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
  q: z.string().trim().min(3).max(200),
});

/**
 * GET /api/geocode?q=...
 * Endpoint público limitado (intake organizadores). Sin claves en cliente.
 */
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!allow(ip)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const parsed = schema.safeParse({ q: req.nextUrl.searchParams.get("q") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetro q requerido (mín. 3)" }, { status: 400 });
  }

  try {
    const results = await searchEventLocations(parsed.data.q, {
      countryCode: "ar",
      limit: 5,
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Geocodificación no disponible" }, { status: 502 });
  }
}
