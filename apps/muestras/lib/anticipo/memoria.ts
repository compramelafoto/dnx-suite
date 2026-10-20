import type { ObraDelAnticipo } from "./elegir";

/**
 * La última respuesta del anticipo para cada huella de IP y muestra (spec D23): pasado el freno se
 * repite en vez de sortear otra vez, así recargar en bucle no muestra más obras. En memoria de la
 * instancia, con tope de tamaño (se van las más viejas). La IP en claro nunca se guarda.
 */
const MAX = 5_000;
const memoria = new Map<string, ObraDelAnticipo[]>();

export function recordarAnticipo(huella: string, slug: string, obras: ObraDelAnticipo[]) {
  const clave = `${huella}:${slug}`;
  memoria.delete(clave);
  memoria.set(clave, obras);
  for (const k of memoria.keys()) {
    if (memoria.size <= MAX) break;
    memoria.delete(k);
  }
}

export function ultimoAnticipo(huella: string, slug: string): ObraDelAnticipo[] {
  return memoria.get(`${huella}:${slug}`) ?? [];
}

/** Sólo para los tests. */
export function olvidarAnticipos() {
  memoria.clear();
}
