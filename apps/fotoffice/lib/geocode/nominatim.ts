import { createNominatimProvider, type NormalizedPlace } from "@repo/geo";

/**
 * El proveedor de geocodificación de FotOffice.
 *
 * **Todo el trabajo lo hace `@repo/geo`** (el DNX GEO ENGINE): armar la URL, pedirla, normalizar
 * la respuesta de Nominatim a `NormalizedPlace` y deducir la precisión. Acá sólo se decide lo
 * que es de esta aplicación: quién dice ser (el `User-Agent`) y cuánto se espera antes de
 * rendirse. Nada de esto vuelve a escribir la lectura de la respuesta —CLF sí tiene su propia
 * copia, `lib/geocode/nominatim-address.ts`, que es anterior al paquete compartido—.
 *
 * **Sólo en el servidor.** La política de uso de Nominatim pide un `User-Agent` que identifique
 * a la aplicación y un ritmo razonable; las dos cosas se cumplen desde el proxy
 * (`app/api/geocode`), nunca desde el navegador de quien completa el formulario.
 */

/**
 * Quién dice ser FotOffice ante Nominatim.
 *
 * La política pide identificar la aplicación de forma que se pueda contactar a alguien si algo
 * molesta. Se puede pisar con `GEOCODING_USER_AGENT` sin tocar el código, que es lo que hay que
 * hacer el día que cambie el dominio.
 */
export const NOMINATIM_USER_AGENT =
  process.env.GEOCODING_USER_AGENT?.trim() ||
  "FotOffice/1.0 (DNX Suite; coberturas; https://fotoffice.com.ar)";

/**
 * Cuánto se espera a Nominatim.
 *
 * Es un servicio gratuito y a veces tarda. Ocho segundos es lo que espera CLF: suficiente para
 * una respuesta lenta, poco para dejar colgada una función de Vercel que alguien está mirando
 * desde el teléfono.
 */
export const GEOCODE_TIMEOUT_MS = 8000;

export const GEOCODE_MIN_QUERY_LENGTH = 3;
export const GEOCODE_MAX_QUERY_LENGTH = 200;

/**
 * `fetch` con corte por tiempo.
 *
 * Se inyecta en el proveedor en vez de envolver el proveedor entero: `createNominatimProvider`
 * acepta `fetchImpl` justamente para esto, así que el corte se agrega sin duplicar una sola
 * línea de lo que el paquete ya hace.
 */
const fetchConTiempoLimite: typeof fetch = async (input, init) => {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), GEOCODE_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: control.signal });
  } finally {
    clearTimeout(reloj);
  }
};

const proveedor = createNominatimProvider({
  userAgent: NOMINATIM_USER_AGENT,
  fetchImpl: fetchConTiempoLimite,
});

export function geocodingProvider() {
  return proveedor;
}

/**
 * La consulta, recortada y validada.
 *
 * `null` cuando no llega al mínimo: Nominatim no devuelve nada útil con dos letras y no tiene
 * sentido gastarle un pedido.
 */
export function normalizeGeocodeQuery(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.trim().slice(0, GEOCODE_MAX_QUERY_LENGTH);
  return q.length < GEOCODE_MIN_QUERY_LENGTH ? null : q;
}

/**
 * Lo que viaja al navegador de un `NormalizedPlace`.
 *
 * `raw` se descarta a propósito: es la respuesta entera de Nominatim, pesa varios kilobytes por
 * resultado y quien completa el formulario desde el teléfono con datos móviles la paga sin
 * usarla. El resto del `NormalizedPlace` viaja tal cual, con los mismos nombres del paquete
 * compartido, así que el cliente sigue hablando el idioma del DNX GEO ENGINE.
 */
export type PlaceDto = Omit<NormalizedPlace, "raw">;

export function toPlaceDto(place: NormalizedPlace): PlaceDto {
  const { raw: _descartado, ...resto } = place;
  return resto;
}
