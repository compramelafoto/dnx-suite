/**
 * Cuánto tarda un jurado y cuánto le falta.
 *
 * El dato existe para que alguien sepa cuánto trabajo le queda, no para medir a
 * gente que muchas veces califica gratis: cada jurado ve su propia estimación y
 * el organizador ve el promedio del equipo, nunca el rendimiento de a uno.
 *
 * Se apoya en `FotorankJuryActivityHeartbeat`, que existe desde julio sin que la
 * use nadie, con su `activeSecondsAccumulated` y su umbral de 75 segundos.
 */

/**
 * Cuántas fotos hacen falta antes de arriesgar una estimación.
 *
 * Con tres la media miente: las primeras siempre son lentas porque la persona
 * está entendiendo la escala y mirando dónde queda cada criterio.
 */
export const FOTOS_MINIMAS_PARA_ESTIMAR = 10;

/** El mismo umbral que trae el modelo: más de esto sin señales es estar ausente. */
export const UMBRAL_DE_INACTIVIDAD_SEGUNDOS = 75;

export type Ritmo = { segundosPorFoto: number };

export function ritmoDelJurado(input: {
  segundosActivos: number;
  fotosCalificadas: number;
}): Ritmo | null {
  if (!Number.isFinite(input.segundosActivos) || input.segundosActivos <= 0) return null;
  if (!Number.isFinite(input.fotosCalificadas)) return null;
  if (input.fotosCalificadas < FOTOS_MINIMAS_PARA_ESTIMAR) return null;

  return { segundosPorFoto: Math.round(input.segundosActivos / input.fotosCalificadas) };
}

/**
 * Cuánto le queda, en palabras.
 *
 * Redondeado hacia arriba y en tramos: una estimación al minuto se lee como una
 * promesa, y la primera vez que no se cumple nadie vuelve a creerle.
 */
export function loQueFalta(input: {
  segundosPorFoto: number;
  fotosQueFaltan: number;
}): string {
  if (input.fotosQueFaltan < 1 || input.segundosPorFoto <= 0) return "";

  const minutos = Math.ceil((input.segundosPorFoto * input.fotosQueFaltan) / 60);

  if (minutos < 10) return "te queda menos de diez minutos";
  if (minutos < 60) {
    const redondeado = Math.ceil(minutos / 10) * 10;
    return `te quedan alrededor de ${redondeado} minutos`;
  }

  const horas = minutos / 60;
  const enMedias = Math.ceil(horas * 2) / 2;
  if (enMedias === 1) return "te queda alrededor de una hora";
  if (enMedias === 1.5) return "te queda alrededor de una hora y media";
  if (Number.isInteger(enMedias)) return `te quedan alrededor de ${enMedias} horas`;
  return `te quedan alrededor de ${Math.floor(enMedias)} horas y media`;
}

/**
 * Cuánto suma este latido al tiempo activo.
 *
 * Dos señales tienen que darse a la vez. Con la pantalla oculta —minimizada o en
 * otra solapa— no se suma nada: sin eso, dejar la pestaña abierta toda la noche
 * daría ocho horas de trabajo. Y con la pantalla a la vista pero sin teclado ni
 * mouse tampoco: alcanzaba con dejar el visor en primer plano.
 *
 * Un hueco largo entre latidos es alguien que volvió, no alguien que trabajó
 * todo ese rato, así que se recorta al umbral.
 */
export function sumarAlLatido(input: {
  acumulado: number;
  segundosDesdeElUltimo: number;
  pantallaVisible: boolean;
  huboInteraccion: boolean;
}): number {
  if (!input.pantallaVisible || !input.huboInteraccion) return input.acumulado;
  if (!Number.isFinite(input.segundosDesdeElUltimo) || input.segundosDesdeElUltimo <= 0) {
    return input.acumulado;
  }

  const suma = Math.min(input.segundosDesdeElUltimo, UMBRAL_DE_INACTIVIDAD_SEGUNDOS);
  return input.acumulado + Math.round(suma);
}
