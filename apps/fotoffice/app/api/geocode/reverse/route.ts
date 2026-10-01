import { NextResponse, type NextRequest } from "next/server";
import { validateCoordinates } from "@repo/geo";
import { geocodingProvider, toPlaceDto } from "@/lib/geocode/nominatim";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/geocode/reverse?lat=…&lon=…  → qué dirección hay en ese punto.
 *
 * Es lo que hace que arrastrar el pin sirva de algo: la organización mueve el marcador a la
 * entrada de verdad y el formulario puede ofrecerle la dirección de ese punto en vez de dejar
 * escrita la que buscó.
 *
 * Mismo tope y mismo motivo que la búsqueda (ver `../route.ts`), con su propio contador: arrastrar
 * el pin y escribir la dirección son dos cosas distintas y una no tiene por qué gastarle el cupo
 * a la otra.
 *
 * `validateCoordinates` es la del DNX GEO ENGINE, la misma que valida el punto cuando se guarda
 * la solicitud: rango, números finitos y el 0,0 que casi siempre es un campo vacío disfrazado de
 * coordenada.
 */
export async function GET(req: NextRequest) {
  const freno = checkRateLimit({
    key: `geocode-rev:${clientIp(req.headers)}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!freno.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos seguidos. Probá de nuevo en un minuto." },
      { status: 429 },
    );
  }

  const punto = validateCoordinates(
    req.nextUrl.searchParams.get("lat"),
    req.nextUrl.searchParams.get("lon"),
  );
  if (!punto.ok) {
    return NextResponse.json({ error: punto.reason }, { status: 400 });
  }

  try {
    const lugar = await geocodingProvider().reverse(
      punto.coordinates.latitude,
      punto.coordinates.longitude,
    );
    return NextResponse.json(lugar ? toPlaceDto(lugar) : null);
  } catch (err: unknown) {
    const cortado = err instanceof Error && err.name === "AbortError";
    if (!cortado) console.error("GET /api/geocode/reverse:", err);
    return NextResponse.json(
      { error: cortado ? "El buscador de direcciones tardó demasiado." : "No pudimos leer ese punto." },
      { status: cortado ? 504 : 502 },
    );
  }
}
