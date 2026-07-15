import { NextRequest, NextResponse } from "next/server";
import {
  NOMINATIM_BASE_URL,
  NOMINATIM_USER_AGENT_REVERSE,
  extractCityFromNominatimAddress,
  fetchNominatimJson,
  parseLatLon,
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
 * GET /api/geocode/reverse?lat=...&lon=...
 * Respuesta allowlisted: { display_name, city }.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit({
      key: `geocode-rev:${ip}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes" },
        { status: 429 }
      );
    }

    const parsed = parseLatLon(
      req.nextUrl.searchParams.get("lat"),
      req.nextUrl.searchParams.get("lon")
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const url = `${NOMINATIM_BASE_URL}/reverse?lat=${parsed.lat}&lon=${parsed.lon}&format=json&addressdetails=1`;

    let res: Response;
    try {
      res = await fetchNominatimJson(
        url,
        NOMINATIM_USER_AGENT_REVERSE,
        "es"
      );
    } catch (err: unknown) {
      const aborted =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("aborted"));
      return NextResponse.json(
        { error: "Error al obtener dirección" },
        { status: aborted ? 504 : 500 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "Error al obtener dirección" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };

    return NextResponse.json({
      display_name: data.display_name ?? "",
      city: extractCityFromNominatimAddress(data.address),
    });
  } catch (err: unknown) {
    console.error("GET /api/geocode/reverse:", err);
    return NextResponse.json(
      { error: "Error al obtener dirección" },
      { status: 500 }
    );
  }
}
