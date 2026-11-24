/**
 * Cola de «Elegir de corrido»: los packs que el fotógrafo va a elegir por las familias, uno
 * atrás del otro. Vive en `sessionStorage` (clave `COLA_ELEGIR_KEY`) mientras dura la tanda.
 */

export const COLA_ELEGIR_KEY = "clf:cola-elegir";

/** Ids de pack válidos, sin repetir y en el orden en que llegan. */
export function armarCola(packOrderIds: number[]): number[] {
  const out: number[] = [];
  for (const id of packOrderIds) {
    if (Number.isInteger(id) && id > 0 && !out.includes(id)) out.push(id);
  }
  return out;
}

/** La cola guardada (texto JSON); cualquier cosa rara es una cola vacía. */
export function leerCola(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? armarCola(v.filter((x): x is number => typeof x === "number")) : [];
  } catch {
    return [];
  }
}

/** Saca de la cola el pack recién elegido (si estaba) y devuelve el próximo. */
export function siguienteDeLaCola(cola: number[], hecho: number | null): { siguiente: number | null; resto: number[] } {
  const pendientes = hecho == null ? cola : cola.filter((id) => id !== hecho);
  const [siguiente = null, ...resto] = pendientes;
  return { siguiente, resto };
}
