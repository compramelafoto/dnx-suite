import { NextRequest, NextResponse } from "next/server";
import {
  GEOCODE_MIN_QUERY_LENGTH,
  NOMINATIM_BASE_URL,
  NOMINATIM_USER_AGENT_SEARCH,
  fetchNominatimJson,
  mapNominatimSearchResults,
  normalizeGeocodeQuery,
  type NominatimSearchHit,
} from "@/lib/geocode/nominatim-address";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * GET /api/geocode?q=...
 * Proxy allowlisted a Nominatim (no open proxy).
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit({ key: `geocode:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 }
      );
    }

    const q = normalizeGeocodeQuery(req.nextUrl.searchParams.get("q"));
    if (!q) {
      return NextResponse.json(
        {
          error: `Parámetro 'q' requerido (mín. ${GEOCODE_MIN_QUERY_LENGTH} caracteres)`,
        },
        { status: 400 }
      );
    }

    const url = new URL(`${NOMINATIM_BASE_URL}/search`);
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");

    let res: Response;
    try {
      res = await fetchNominatimJson(url.toString(), NOMINATIM_USER_AGENT_SEARCH);
    } catch (err: unknown) {
      const aborted =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("aborted"));
      return NextResponse.json(
        { error: aborted ? "Timeout en geocoding" : "Error en geocoding" },
        { status: aborted ? 504 : 500 }
      );
    }

    if (!res.ok) {
      return NextResponse.json({ error: "Error en geocoding" }, { status: 502 });
    }

    const data = (await res.json()) as NominatimSearchHit[];
    if (!Array.isArray(data)) {
      return NextResponse.json([]);
    }

    return NextResponse.json(mapNominatimSearchResults(data));
  } catch (err: unknown) {
    console.error("GET /api/geocode:", err);
    return NextResponse.json({ error: "Error en geocoding" }, { status: 500 });
  }
}
