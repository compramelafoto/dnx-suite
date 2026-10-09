import "server-only";
import { unstable_cache } from "next/cache";
import { createNominatimProvider } from "@repo/geo";
import { elegirLugar } from "./elegir-lugar";

/** Si Nominatim tarda más que esto, el buscador avisa en vez de dejar a la persona esperando. */
export const TIEMPO_MAXIMO_MS = 5000;
/** Lo mismo buscado de nuevo (Rosario, Córdoba…) no vuelve a Nominatim durante un día. */
export const CACHE_SEGUNDOS = 24 * 60 * 60;

const USER_AGENT = "MuestrasFotograficas/1.0 (+https://muestrasfotograficas.com)";

export type PuntoBuscado = { latitude: number; longitude: number; city: string | null };

/** La clave de la caché: "  Rosario " y "rosario" son la misma búsqueda. */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

/** `fetch` con tiempo máximo: corta el pedido a los TIEMPO_MAXIMO_MS. */
export const fetchConTiempoMaximo: typeof fetch = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });

/**
 * Un texto → un punto habitable en Argentina, o null si no hay. Un error (red, tiempo agotado,
 * respuesta rara) se propaga: así no queda guardado en la caché.
 */
export async function ubicarTexto(texto: string, fetchImpl: typeof fetch = fetchConTiempoMaximo): Promise<{ punto: PuntoBuscado | null }> {
  const resultados = await createNominatimProvider({
    userAgent: process.env.GEOCODING_USER_AGENT || USER_AGENT,
    fetchImpl,
  }).search(texto, { limit: 5, countryCode: "ar" });
  const elegido = elegirLugar(resultados);
  return { punto: elegido ? { latitude: elegido.latitude, longitude: elegido.longitude, city: elegido.city } : null };
}

/** `ubicarTexto` con caché de un día por texto normalizado (también guarda el "no encontrado"). */
export const ubicarConCache = unstable_cache(
  async (normalizado: string) => ubicarTexto(normalizado),
  ["muestras-buscar-cerca-v1"],
  { revalidate: CACHE_SEGUNDOS },
);
