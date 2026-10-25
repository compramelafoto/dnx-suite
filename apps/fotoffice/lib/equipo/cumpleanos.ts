import { esFechaValida, sumarDias } from "./fechas";

/**
 * Qué día se le saluda el cumpleaños. Módulo PURO.
 *
 * El mismo día si trabaja. Si ese día no trabaja (domingo, el sábado que le toca a la otra,
 * feriado o franco), se la saluda en su último día de trabajo antes del cumpleaños. Se busca
 * hasta dos semanas para atrás: si en ese lapso no trabajó ningún día (vacaciones), no hay un
 * día razonable para saludarla y no se fuerza.
 */

const BUSQUEDA_MAXIMA_DIAS = 14;

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/** El cumpleaños de ese año ("AAAA-MM-DD"). El 29 de febrero, en un año no bisiesto, es el 28. */
export function cumpleanosDelAnio(fechaNacimiento: string, anio: number): string | null {
  if (!esFechaValida(fechaNacimiento)) return null;
  const mmdd = fechaNacimiento.slice(5);
  if (mmdd === "02-29" && !esBisiesto(anio)) return `${anio}-02-28`;
  return `${anio}-${mmdd}`;
}

/** El día en que se la saluda ese año, o null si no hay uno razonable. */
export function diaDelSaludoDeCumple(
  fechaNacimiento: string,
  anio: number,
  trabaja: (fecha: string) => boolean,
): string | null {
  const cumple = cumpleanosDelAnio(fechaNacimiento, anio);
  if (!cumple) return null;
  for (let atras = 0; atras <= BUSQUEDA_MAXIMA_DIAS; atras++) {
    const dia = sumarDias(cumple, -atras);
    if (trabaja(dia)) return dia;
  }
  return null;
}

/**
 * Si hoy se la saluda por su cumpleaños.
 *
 * Además del día calculado, también se la saluda el día mismo del cumpleaños si está
 * trabajando de verdad (abrió la caja aunque no le tocaba): sería raro que el sistema la
 * ignore justo ese día. Se mira el cumpleaños de este año y el del siguiente, porque el de un
 * 1 de enero que cae domingo se saluda el 31 de diciembre.
 */
export function saludaCumpleHoy(p: {
  fechaNacimiento: string | null;
  hoy: string;
  trabaja: (fecha: string) => boolean;
  estaTrabajandoHoy: boolean;
}): boolean {
  if (!p.fechaNacimiento || !esFechaValida(p.fechaNacimiento)) return false;
  const anio = Number(p.hoy.slice(0, 4));
  if (p.estaTrabajandoHoy && cumpleanosDelAnio(p.fechaNacimiento, anio) === p.hoy) return true;
  return [anio, anio + 1].some((a) => diaDelSaludoDeCumple(p.fechaNacimiento!, a, p.trabaja) === p.hoy);
}
