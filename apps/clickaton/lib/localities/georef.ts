/**
 * Ubica una localidad argentina con la API oficial Georef (datos.gob.ar).
 *
 * Es gratuita, no pide clave y conoce las localidades del país por nombre y
 * provincia, que es justo lo que escribe la gente al inscribirse. Nominatim
 * (OpenStreetMap) se descartó: devuelve calles y negocios con el mismo nombre y
 * exige un pedido por segundo.
 *
 * Nunca decide sola ante la duda: si hay más de una localidad posible, la
 * marca DUDOSA con sus candidatas para que alguien elija en el panel.
 */
import { normalizarCiudad } from "./clave";

const GEOREF = "https://apis.datos.gob.ar/georef/api/localidades";

export type CandidataDeLocalidad = {
  ciudad: string;
  provincia: string;
  departamento: string | null;
  lat: number;
  lng: number;
};

export type LocalidadUbicada =
  | { estado: "RESUELTA"; elegida: CandidataDeLocalidad; candidatas: CandidataDeLocalidad[] }
  | { estado: "DUDOSA"; candidatas: CandidataDeLocalidad[] }
  | { estado: "NO_ENCONTRADA"; candidatas: [] };

type RespuestaGeoref = {
  localidades?: {
    nombre: string;
    provincia?: { nombre?: string };
    departamento?: { nombre?: string | null };
    centroide?: { lat?: number; lon?: number };
  }[];
};

async function consultar(
  nombre: string,
  provincia: string | null,
  fetchImpl: typeof fetch,
): Promise<CandidataDeLocalidad[]> {
  const url = new URL(GEOREF);
  url.searchParams.set("nombre", nombre);
  if (provincia) url.searchParams.set("provincia", provincia);
  url.searchParams.set("campos", "nombre,provincia.nombre,departamento.nombre,centroide");
  url.searchParams.set("max", "10");
  const respuesta = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  if (!respuesta.ok) throw new Error(`GEOREF_${respuesta.status}`);
  const datos = (await respuesta.json()) as RespuestaGeoref;
  return (datos.localidades ?? []).flatMap((l) => {
    const lat = l.centroide?.lat;
    const lng = l.centroide?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") return [];
    return [
      {
        ciudad: l.nombre,
        provincia: l.provincia?.nombre ?? "",
        departamento: l.departamento?.nombre ?? null,
        lat,
        lng,
      },
    ];
  });
}

function decidir(buscada: string, candidatas: CandidataDeLocalidad[]): LocalidadUbicada | null {
  if (candidatas.length === 0) return null;
  const exactas = candidatas.filter((c) => normalizarCiudad(c.ciudad) === buscada);
  if (exactas.length === 1) {
    return { estado: "RESUELTA", elegida: exactas[0]!, candidatas };
  }
  return { estado: "DUDOSA", candidatas: exactas.length > 1 ? exactas : candidatas };
}

export async function ubicarLocalidad(
  input: { ciudad: string; provincia: string | null; pais?: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<LocalidadUbicada> {
  if (input.pais && input.pais.toUpperCase() !== "AR") {
    return { estado: "NO_ENCONTRADA", candidatas: [] };
  }
  const buscada = normalizarCiudad(input.ciudad);
  if (!buscada) return { estado: "NO_ENCONTRADA", candidatas: [] };

  // Primero con la provincia que escribió; si no la reconoce ("S", "Snta Fe"),
  // sin ella: la ciudad sola suele alcanzar, y si no, queda dudosa.
  const conProvincia = input.provincia
    ? decidir(buscada, await consultar(input.ciudad, input.provincia, fetchImpl))
    : null;
  if (conProvincia) return conProvincia;

  const sinProvincia = decidir(buscada, await consultar(input.ciudad, null, fetchImpl));
  return sinProvincia ?? { estado: "NO_ENCONTRADA", candidatas: [] };
}
