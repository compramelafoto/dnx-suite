/**
 * La marca de agua sobre el video.
 *
 * **Disuade, no impide** (spec, sección 4): alguien con conocimientos la quita desde el
 * navegador. Contra el caso real —filmar la pantalla y pasar el archivo— sirve, porque la copia
 * lleva escrito quién la filtró. Cambia de lugar para que no se pueda tapar con un recorte fijo.
 */

export const SEGUNDOS_POR_POSICION = 25;

export function textoDeMarca(input: { nombre: string; dni: string; numero: string }): string {
  return `${input.nombre} · DNI ${input.dni} · #${input.numero}`;
}

/** Seis lugares repartidos por la imagen; el orden salta para que no sea una vuelta previsible. */
const POSICIONES = [
  { top: 8, left: 6 },
  { top: 78, left: 55 },
  { top: 40, left: 30 },
  { top: 12, left: 52 },
  { top: 82, left: 8 },
  { top: 55, left: 58 },
];
const ORDEN = [0, 3, 1, 5, 2, 4];

export function posicionDeMarca(paso: number): { top: number; left: number } {
  const i = ((Math.floor(paso) % ORDEN.length) + ORDEN.length) % ORDEN.length;
  return POSICIONES[ORDEN[i]];
}
