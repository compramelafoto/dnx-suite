/**
 * El domicilio del estudio del fotógrafo, y sus coordenadas.
 *
 * ── Por qué no se piden la latitud y la longitud ──
 *
 * Nadie sabe sus coordenadas. Lo que todo el mundo sí sabe hacer es abrir Google Maps, pararse en
 * su local y copiar el enlace. Así que el formulario pide **un enlace de Google Maps**, y de ahí
 * se sacan los números. Si alguien prefiere pegar las coordenadas sueltas, también se aceptan.
 *
 * ── Por qué importa que estén ──
 *
 * Sin coordenadas, Google tiene que adivinar dónde queda "San José 1672" —hay una San José en cada
 * ciudad del país—. Con coordenadas, el estudio entra en las búsquedas de "fotógrafo cerca mío".
 * Es la diferencia entre aparecer en el mapa y no aparecer.
 *
 * ── Qué NO hace ──
 *
 * No geocodifica: no convierte una dirección escrita en coordenadas. Eso necesita un servicio
 * externo con su clave, su costo y su cuota. Acá se leen las coordenadas que el socio ya tiene
 * delante cuando mira su local en el mapa.
 */

export type StudioLocationInput = {
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  /** Enlace de Google Maps, o "lat, lng". Vacío borra las coordenadas. */
  mapsUrlOrCoords?: string | null;
};

export type StudioCoords = { lat: number; lng: number };

export type StudioLocationParse =
  | { ok: true; data: {
      studioStreet: string | null;
      studioCity: string | null;
      studioProvince: string | null;
      studioPostalCode: string | null;
      studioLat: number | null;
      studioLng: number | null;
    } }
  | { ok: false; error: string; field: string };

const MAX_TRAMO = 120;

/** Un acortador `maps.app.goo.gl` o `goo.gl/maps` no lleva las coordenadas adentro. */
const ACORTADOR = /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i;

/**
 * Las coordenadas escondidas en un enlace de Google Maps.
 *
 * Google usa varias formas para lo mismo, y conviven en el mismo enlace:
 *   .../maps/@-32.9174,-60.6505,17z          ← el centro del mapa (lo más común al copiar)
 *   .../maps/place/X/@-32.9,-60.6,17z/data=…  ← el lugar, con el centro detrás
 *   ...?q=-32.9174,-60.6505                   ← enlace de "compartir ubicación"
 *   ...!3d-32.9174!4d-60.6505                 ← el punto exacto del lugar, dentro de `data`
 *
 * Se prueba `!3d!4d` PRIMERO: cuando está, es el punto del local, mientras que `@` es apenas
 * donde quedó centrada la pantalla, que puede estar media cuadra corrida.
 */
export function coordsDesdeGoogleMaps(texto: string): StudioCoords | null {
  const t = texto.trim();
  if (t === "") return null;

  const intentos: RegExp[] = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?)%2C\s*(-?\d+(?:\.\d+)?)/i,
    /[?&]q=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
  ];

  for (const re of intentos) {
    const m = re.exec(t);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (sonCoordenadasValidas(lat, lng)) return { lat, lng };
  }
  return null;
}

export function sonCoordenadasValidas(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    // (0, 0) está en el Atlántico, frente a África: siempre es un error, nunca un estudio.
    !(lat === 0 && lng === 0)
  );
}

function limpiar(v: string | null | undefined): string | null {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? null : t.slice(0, MAX_TRAMO);
}

/**
 * Valida y normaliza lo que el socio cargó sobre su estudio.
 *
 * Todo es opcional: un fotógrafo que trabaja a domicilio no tiene local, y no por eso se le
 * rechaza el perfil. Lo único que se rechaza es un enlace que el socio creyó que servía y no
 * sirve —ahí callar sería peor, porque se iría pensando que quedó en el mapa—.
 */
export function parseStudioLocation(entrada: StudioLocationInput): StudioLocationParse {
  const crudo = (entrada.mapsUrlOrCoords ?? "").trim();
  let lat: number | null = null;
  let lng: number | null = null;

  if (crudo !== "") {
    const c = coordsDesdeGoogleMaps(crudo);
    if (!c) {
      return {
        ok: false,
        field: "studioMapsUrl",
        error: ACORTADOR.test(crudo)
          ? "Ese enlace corto de Google Maps no trae la ubicación adentro. Abrilo en el navegador y copiá la dirección larga que queda arriba."
          : "No pudimos leer la ubicación de ese enlace. Abrí tu local en Google Maps y copiá la dirección de la barra del navegador.",
      };
    }
    lat = c.lat;
    lng = c.lng;
  }

  return {
    ok: true,
    data: {
      studioStreet: limpiar(entrada.street),
      studioCity: limpiar(entrada.city),
      studioProvince: limpiar(entrada.province),
      studioPostalCode: limpiar(entrada.postalCode),
      studioLat: lat,
      studioLng: lng,
    },
  };
}

export type StudioLocation = {
  street: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
};

/** La dirección en una línea, como se escribe en un sobre. Vacía si no hay nada que escribir. */
export function direccionEnUnaLinea(l: StudioLocation): string | null {
  const partes = [l.street, l.city, l.province].filter(Boolean);
  if (partes.length === 0) return null;
  const linea = partes.join(", ");
  return l.postalCode ? `${linea} (${l.postalCode})` : linea;
}

/** Tiene algo publicable: con una ciudad sola ya se puede decir dónde trabaja. */
export function tieneUbicacionPublicable(l: StudioLocation): boolean {
  return Boolean(l.street || l.city);
}

/**
 * Enlace para abrir el estudio en un mapa.
 *
 * Con coordenadas apunta al punto exacto; sin ellas, a la búsqueda del texto de la dirección, que
 * es lo que haría a mano cualquiera que quiera llegar.
 */
export function enlaceAlMapa(l: StudioLocation): string | null {
  if (l.lat !== null && l.lng !== null && sonCoordenadasValidas(l.lat, l.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${l.lat}%2C${l.lng}`;
  }
  const linea = direccionEnUnaLinea(l);
  return linea ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(linea)}` : null;
}
