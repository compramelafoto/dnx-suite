import { NextResponse, type NextRequest } from "next/server";
import { createNominatimProvider } from "@repo/geo";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Buscar una dirección. Proxy a Nominatim con nuestro `User-Agent` y un tope por persona.
 * Sólo se usa al cargar el lugar de una actividad, que ya exige sesión: sin ella este endpoint
 * sería un proxy abierto a Nominatim con nuestra IP. El resultado se guarda en la ficha y no se
 * vuelve a pedir.
 */
export async function GET(req: NextRequest) {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.json({ error: "Tenés que ingresar para buscar direcciones." }, { status: 401 });
  const freno = frenarPorUsuario("geocode", usuario.id);
  if (!freno.allowed) {
    return NextResponse.json({ error: "Demasiadas búsquedas seguidas. Probá en un minuto." }, { status: 429 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 3) return NextResponse.json({ error: "Escribí al menos 3 caracteres." }, { status: 400 });
  try {
    const lugares = await createNominatimProvider({
      userAgent: process.env.GEOCODING_USER_AGENT || "MuestrasFotograficas/1.0 (+https://muestrasfotograficas.com)",
    }).search(q, { limit: 5 });
    return NextResponse.json(
      lugares.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        displayName: p.displayName,
        address: p.address,
        city: p.city,
        province: p.province,
      })),
    );
  } catch (err) {
    console.error("GET /api/geocode:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "No pudimos buscar esa dirección." }, { status: 502 });
  }
}
