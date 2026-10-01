import type { NormalizedPlace } from "@repo/geo";

/**
 * Cómo se dice un lugar en pantalla y cómo se abre en el teléfono.
 *
 * Módulo puro: sin Prisma, sin `server-only` y sin tocar la red. Lo usan el buscador del
 * formulario público (en el navegador) y las fichas de la solicitud y la cobertura (en el
 * servidor), así que tiene que poder cruzar las dos fronteras.
 *
 * `@repo/geo` trae `formatLocationLabel`, pero arma la etiqueta editorial de InfoSpot —ciudad,
 * provincia, país— que es justo lo que acá no sirve: quien va a cubrir un evento necesita la
 * calle y el número, no la provincia. Lo que sí se reutiliza es el `NormalizedPlace`, que es el
 * contrato del paquete.
 */

/** Lo que viaja del proxy al navegador: un `NormalizedPlace` sin la respuesta cruda. */
export type Lugar = Omit<NormalizedPlace, "raw">;

/**
 * La dirección que se escribe en el campo cuando se elige una sugerencia.
 *
 * Primero el nombre del lugar («Club Social y Deportivo»), después la calle y el número, y al
 * final la localidad. Es el orden en que lo diría alguien por teléfono, y el que pide la
 * etiqueta del campo: «nombre del lugar y dirección exacta».
 *
 * Cuando Nominatim no da ninguna de las tres partes queda el `displayName`, que es largo y trae
 * el país y el código postal, pero es preferible a dejar el campo vacío después de que la
 * persona eligió un resultado.
 */
export function direccionDeLugar(lugar: Lugar): string {
  const partes = [lugar.locationName, lugar.address, lugar.city]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  // Sin duplicar: Nominatim a veces repite el nombre del lugar como "address".
  const unicas = partes.filter((p, i) => partes.indexOf(p) === i);
  return unicas.length > 0 ? unicas.join(", ") : lugar.displayName.trim();
}

/** Cuántos decimales se muestran: seis ≈ 11 cm. Más es ruido. */
const DECIMALES = 6;

export function coordenadasLegibles(latitude: number, longitude: number): string {
  return `${latitude.toFixed(DECIMALES)}, ${longitude.toFixed(DECIMALES)}`;
}

/**
 * El enlace que abre el punto en la aplicación de mapas del teléfono.
 *
 * `https://www.google.com/maps?q=lat,lon` y no un `geo:` ni un enlace de Apple Maps: es el único
 * formato que en Android e iOS abre la aplicación instalada si la hay, y una página si no la
 * hay. Es el mismo que ya usa CompraMeLaFoto en la pantalla del evento.
 *
 * Va el punto y no la dirección escrita: el punto es justamente lo que la dirección no sabía
 * decir. Si el predio tiene tres accesos, esto abre el que marcó la organización.
 */
export function enlaceDeMapa(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
