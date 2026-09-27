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

/* ---------- el tiempo de cada foto ---------- */

/**
 * Cuánto de este tic se cuenta como trabajo.
 *
 * El latido va al servidor cada treinta segundos, pero una foto se califica en
 * menos de un minuto: repartir de a treinta le daría todo el rato a la que
 * estuviera en pantalla justo al latir. Por eso el visor cuenta de a poco, y
 * sólo mientras haya pantalla a la vista y alguien haya tocado algo hace menos
 * que el umbral: mirar una foto sin mover el mouse también es trabajar.
 */
export function segundosQueCuentan(input: {
  desdeElTicAnterior: number;
  desdeLaUltimaInteraccion: number;
  pantallaVisible: boolean;
}): number {
  if (!input.pantallaVisible) return 0;
  if (!Number.isFinite(input.desdeElTicAnterior) || input.desdeElTicAnterior <= 0) return 0;
  if (
    !Number.isFinite(input.desdeLaUltimaInteraccion) ||
    input.desdeLaUltimaInteraccion > UMBRAL_DE_INACTIVIDAD_SEGUNDOS
  ) {
    return 0;
  }
  // Un tic atrasado (la pestaña dormida, la computadora suspendida) no es trabajo.
  return Math.min(input.desdeElTicAnterior, UMBRAL_DE_INACTIVIDAD_SEGUNDOS);
}

export type TiempoPorFoto = Record<string, number>;

export function sumarALaFoto(
  tiempo: TiempoPorFoto,
  snapshotId: string,
  segundos: number,
): TiempoPorFoto {
  if (!Number.isFinite(segundos) || segundos <= 0) return tiempo;
  return { ...tiempo, [snapshotId]: (tiempo[snapshotId] ?? 0) + segundos };
}

/**
 * Lo que ya quedó guardado se descuenta; lo demás espera al latido siguiente.
 *
 * Una foto que se mira antes de ponerle la primera nota todavía no tiene fila
 * en la base: ese tiempo se guarda en el navegador y se anota cuando exista.
 * Si no, se perdería justo el rato de mirarla, que es el más largo.
 */
export function descontarLoAnotado(
  tiempo: TiempoPorFoto,
  enviado: Array<{ snapshotId: string; segundos: number }>,
  anotadas: string[],
): TiempoPorFoto {
  const siguen = { ...tiempo };
  const yaEstan = new Set(anotadas);
  for (const e of enviado) {
    if (!yaEstan.has(e.snapshotId)) continue;
    const resto = (siguen[e.snapshotId] ?? 0) - e.segundos;
    if (resto > 0.5) siguen[e.snapshotId] = resto;
    else delete siguen[e.snapshotId];
  }
  return siguen;
}

/** Más fotos que esto en un latido es alguien recorriendo, no calificando. */
export const FOTOS_POR_LATIDO = 30;

/** Tope por foto y por latido: alcanza para varios latidos perdidos seguidos. */
export const TOPE_POR_FOTO_POR_LATIDO = 15 * 60;

/**
 * Lo que manda el navegador, antes de escribirlo.
 *
 * Lo manda el propio jurado, así que se limpia: enteros positivos, una fila por
 * foto y un tope razonable, para que un pedido armado a mano no le escriba
 * horas a nadie.
 */
export function limpiarTiempoPorFoto(
  porFoto: Array<{ snapshotId: unknown; segundos: unknown }> | undefined,
): Array<{ snapshotId: string; segundos: number }> {
  if (!Array.isArray(porFoto)) return [];
  const sumado = new Map<string, number>();
  for (const f of porFoto) {
    if (typeof f?.snapshotId !== "string" || f.snapshotId.length === 0) continue;
    if (typeof f.segundos !== "number" || !Number.isFinite(f.segundos)) continue;
    const s = Math.round(f.segundos);
    if (s <= 0) continue;
    sumado.set(f.snapshotId, (sumado.get(f.snapshotId) ?? 0) + s);
  }
  return [...sumado.entries()]
    .slice(0, FOTOS_POR_LATIDO)
    .map(([snapshotId, segundos]) => ({
      snapshotId,
      segundos: Math.min(segundos, TOPE_POR_FOTO_POR_LATIDO),
    }));
}
