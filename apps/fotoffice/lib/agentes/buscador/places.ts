import "server-only";

/**
 * Cliente mínimo de Google Places API (New), Text Search. Nunca lanza y nunca registra la clave.
 *
 * SKU: se pide sólo `places.id`, `places.displayName`, `places.websiteUri`,
 * `places.formattedAddress` y `nextPageToken`. Google cobra cada llamada al nivel del campo más
 * caro del field mask: `displayName` y `formattedAddress` son de nivel Pro, pero `websiteUri` es
 * Enterprise, así que cada llamada se cobra como `TEXT_SEARCH_ENTERPRISE` (ver `PRECIOS_PLACES`
 * en `gasto.ts`). La web es justamente lo que el Buscador necesita, así que no hay un nivel más
 * barato que sirva. No se pide `places.location` (no guardamos lat/lng), por eso vienen en null.
 *
 * Paginación: cada pedido con `pageToken` es una llamada nueva y se cobra aparte; `paginas` es
 * el tope de llamadas.
 */

const URL_TEXT_SEARCH = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = "places.id,places.displayName,places.websiteUri,places.formattedAddress,nextPageToken";
const SKU_TEXT_SEARCH = "TEXT_SEARCH_ENTERPRISE";
const PLAZO_MS = 10_000;

/** Sólo en memoria: de un lugar se persiste únicamente `placeId`. */
export type LugarPlaces = { placeId: string; nombre: string; web: string | null; direccion: string | null; lat: number | null; lng: number | null };

export type ErrorPlaces = {
  error: "SIN_CLAVE" | "HTTP" | "CUOTA";
  detalle: string;
  /** Las llamadas que ya se hicieron (y se cobraron) antes de fallar, si hubo. */
  llamadas?: Record<string, number>;
};

export type ResultadoPlaces = { lugares: LugarPlaces[]; llamadas: Record<string, number> } | ErrorPlaces;

type RespuestaTextSearch = {
  places?: Array<{ id?: string; displayName?: { text?: string }; websiteUri?: string; formattedAddress?: string }>;
  nextPageToken?: string;
  error?: { code?: number; message?: string; status?: string };
};

/** Un texto corto para el detalle, sin la clave por si Google la repitiera en el mensaje. */
function limpiar(texto: string, clave: string): string {
  const corto = texto.replace(/\s+/g, " ").trim().slice(0, 200);
  return clave ? corto.split(clave).join("[clave]") : corto;
}

export async function buscarLugares(
  consulta: string,
  opciones: { paginas: number; region?: "ar" },
  deps: { fetch?: typeof fetch; clave?: string | null } = {},
): Promise<ResultadoPlaces> {
  const clave = (deps.clave === undefined ? process.env.GOOGLE_PLACES_API_KEY : deps.clave)?.trim();
  if (!clave) return { error: "SIN_CLAVE", detalle: "Falta GOOGLE_PLACES_API_KEY en el servidor." };
  const f = deps.fetch ?? fetch;
  // Por ahora la única región es Argentina.
  const regionCode = "AR";

  const lugares: LugarPlaces[] = [];
  const llamadas: Record<string, number> = {};
  const conLlamadas = () => (Object.keys(llamadas).length ? { llamadas: { ...llamadas } } : {});
  let pageToken: string | undefined;

  for (let pagina = 0; pagina < Math.max(0, Math.floor(opciones.paginas)); pagina++) {
    let res: Response;
    try {
      res = await f(URL_TEXT_SEARCH, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": clave, "X-Goog-FieldMask": FIELD_MASK },
        body: JSON.stringify({ textQuery: consulta, languageCode: "es", regionCode, ...(pageToken ? { pageToken } : {}) }),
        signal: AbortSignal.timeout(PLAZO_MS),
      });
    } catch (e) {
      const nombre = e instanceof Error ? e.name : "error desconocido";
      return { error: "HTTP", detalle: limpiar(`sin respuesta de Google Places (${nombre})`, clave), ...conLlamadas() };
    }

    let cuerpo: RespuestaTextSearch = {};
    try {
      cuerpo = (await res.json()) as RespuestaTextSearch;
    } catch {
      cuerpo = {};
    }

    if (res.status === 429 || cuerpo.error?.status === "RESOURCE_EXHAUSTED") {
      return { error: "CUOTA", detalle: limpiar(`${res.status} ${cuerpo.error?.message ?? "cuota de Google Places agotada"}`, clave), ...conLlamadas() };
    }
    if (!res.ok) {
      return { error: "HTTP", detalle: limpiar(`${res.status} ${cuerpo.error?.message ?? res.statusText}`, clave), ...conLlamadas() };
    }

    llamadas[SKU_TEXT_SEARCH] = (llamadas[SKU_TEXT_SEARCH] ?? 0) + 1;
    for (const p of cuerpo.places ?? []) {
      if (!p.id) continue;
      lugares.push({
        placeId: p.id,
        nombre: p.displayName?.text?.trim() ?? "",
        web: p.websiteUri?.trim() || null,
        direccion: p.formattedAddress?.trim() || null,
        lat: null,
        lng: null,
      });
    }

    pageToken = cuerpo.nextPageToken || undefined;
    if (!pageToken) break;
  }

  return { lugares, llamadas };
}
