import { NextResponse, type NextRequest } from "next/server";
import {
  GEOCODE_MIN_QUERY_LENGTH,
  geocodingProvider,
  normalizeGeocodeQuery,
  toPlaceDto,
} from "@/lib/geocode/nominatim";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/geocode?q=…  → buscar una dirección.
 *
 * Es un proxy, no un endpoint abierto: lo único que se le puede pedir es una búsqueda de texto
 * en Nominatim, con nuestro `User-Agent` y con tope por origen. Existe por dos razones que no se
 * pueden resolver desde el navegador —la política de Nominatim pide identificar la aplicación, y
 * llamar desde el cliente expondría la IP de cada persona que completa el formulario a un
 * tercero—.
 *
 * **Sin sesión, a propósito.** Quien completa el formulario público de coberturas no tiene
 * cuenta: exigir una acá sería romper el único circuito que lo usa. Lo que lo protege es el tope
 * y que no hay nada que escribir ni que leer de la base.
 *
 * Sesenta por minuto y por origen es el mismo número que usa CompraMeLaFoto. Una persona
 * buscando una dirección hace tres o cuatro pedidos (el buscador espera 400 ms entre tecleos);
 * sesenta deja margen para varias personas detrás de la misma red y corta un bucle enseguida.
 */
export async function GET(req: NextRequest) {
  const freno = checkRateLimit({
    key: `geocode:${clientIp(req.headers)}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!freno.allowed) {
    return NextResponse.json(
      { error: "Demasiadas búsquedas seguidas. Probá de nuevo en un minuto." },
      { status: 429 },
    );
  }

  const q = normalizeGeocodeQuery(req.nextUrl.searchParams.get("q"));
  if (!q) {
    return NextResponse.json(
      { error: `Escribí al menos ${GEOCODE_MIN_QUERY_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  try {
    const lugares = await geocodingProvider().search(q, { limit: 5 });
    return NextResponse.json(lugares.map(toPlaceDto));
  } catch (err: unknown) {
    // El corte por tiempo llega como `AbortError`. Se distingue del resto porque no es un error
    // nuestro ni de quien busca: es que Nominatim tardó. Quien completa el formulario puede
    // seguir igual —el punto es opcional— así que el mensaje no dramatiza.
    const cortado = err instanceof Error && err.name === "AbortError";
    if (!cortado) console.error("GET /api/geocode:", err);
    return NextResponse.json(
      { error: cortado ? "El buscador de direcciones tardó demasiado." : "No pudimos buscar esa dirección." },
      { status: cortado ? 504 : 502 },
    );
  }
}
