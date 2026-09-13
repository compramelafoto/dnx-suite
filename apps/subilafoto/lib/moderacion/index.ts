import "server-only";

import { dependenciasReales, fotosPendientes } from "./conectar";
import { procesarFoto, type ResultadoDelProceso } from "./procesar";

export { fotosPendientes };

/** Modera una foto contra la base y el bucket reales. */
export async function moderarFoto(mediaId: string): Promise<ResultadoDelProceso> {
  return procesarFoto(dependenciasReales(), mediaId);
}

/**
 * Modera todo lo que quedó esperando.
 *
 * Es la red de seguridad, no el camino normal: la foto se modera apenas el
 * invitado confirma la subida. Acá caen las que se perdieron porque la función
 * se cortó a mitad o el proceso murió.
 *
 * En serie y no en paralelo a propósito: son las rezagadas, no hay apuro, y
 * disparar treinta llamadas juntas a Amazon las haría fallar por límite de
 * frecuencia justo cuando estamos intentando recuperarlas.
 */
export async function moderarPendientes(limite = 25): Promise<{
  revisadas: number;
  decididas: number;
  yaDecididas: number;
  inexistentes: number;
}> {
  const ids = await fotosPendientes(limite);
  const deps = dependenciasReales();

  let decididas = 0;
  let yaDecididas = 0;
  let inexistentes = 0;

  for (const id of ids) {
    const r = await procesarFoto(deps, id);
    if (r.estado === "decidida") decididas++;
    else if (r.estado === "ya-decidida") yaDecididas++;
    else inexistentes++;
  }

  return { revisadas: ids.length, decididas, yaDecididas, inexistentes };
}
