import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/geocode?q=escuela+buenos+aires
 * Proxy a Nominatim (OpenStreetMap) para búsqueda de direcciones.
 * Retorna resultados con lat, lon, display_name, address.
 * Requiere User-Agent identificando la app (política de uso de Nominatim).
 */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q");
    if (!q || typeof q !== "string" || q.trim().length < 3) {
      return NextResponse.json({ error: "Parámetro 'q' requerido (mín. 3 caracteres)" }, { status: 400 });
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q.trim());
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "ComprameLaFoto/1.0 (fotografia-escolar)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Error en geocoding" }, { status: 502 });
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return NextResponse.json([]);
    }

    const results = data.map((r: { lat: string; lon: string; display_name: string; address?: Record<string, string> }) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      displayName: r.display_name,
      address: r.address || {},
    }));

    return NextResponse.json(results);
  } catch (err: unknown) {
    console.error("GET /api/geocode:", err);
    return NextResponse.json({ error: "Error en geocoding" }, { status: 500 });
  }
}
