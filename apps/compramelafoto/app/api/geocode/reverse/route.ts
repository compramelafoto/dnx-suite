import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "User-Agent": "CompraMeLaFoto/1.0 (event location search)",
  "Accept-Language": "es",
};

/**
 * GET /api/geocode/reverse?lat=...&lon=...
 * Geocodificación inversa (Nominatim). Devuelve { display_name, city }.
 */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  const latNum = lat != null ? parseFloat(String(lat)) : NaN;
  const lonNum = lon != null ? parseFloat(String(lon)) : NaN;
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return NextResponse.json({ error: "Parámetros lat y lon requeridos y numéricos" }, { status: 400 });
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lonNum}&format=json&addressdetails=1`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[geocode/reverse] Nominatim request failed:", res.status);
      }
      return NextResponse.json({ error: "Error al obtener dirección" }, { status: 502 });
    }
    const data = (await res.json()) as {
      display_name?: string;
      address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
    };
    const display_name = data.display_name ?? "";
    const addr = data.address ?? {};
    const city =
      addr.city ?? addr.town ?? addr.village ?? addr.state ?? addr.country ?? "";

    return NextResponse.json({ display_name, city });
  } catch (err: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error("[geocode/reverse] ERROR:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json(
      { error: "Error al obtener dirección" },
      { status: 500 }
    );
  }
}
