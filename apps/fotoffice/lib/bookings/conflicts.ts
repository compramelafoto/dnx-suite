/**
 * Quién bloquea a quién. Módulo PURO: sin base y sin red.
 *
 * ── El defecto es bloquear ──
 *
 * La tabla guarda los pares que SÍ pueden convivir. Todo lo que no está declarado es
 * incompatible. Al revés sería más cómodo de cargar, pero un espacio nuevo mal configurado
 * se alquilaría encima de otro sin que nadie se entere.
 *
 * Elegido así a propósito: el error posible es "no me deja reservar", que la Secretaría
 * nota el primer día y corrige en dos minutos. El error contrario son dos personas
 * llegando el sábado al mismo salón.
 */

export type CompatibilityPair = { spaceAId: string; spaceBId: string };

/** Una sola fila por par, siempre con el menor primero. Sin esto habría duplicados. */
export function normalizePair(a: string, b: string): CompatibilityPair {
  return a <= b ? { spaceAId: a, spaceBId: b } : { spaceAId: b, spaceBId: a };
}

/** Con qué espacios puede convivir. El otro lado del par, mire de donde se mire. */
export function compatibleSpaceIds(
  spaceId: string,
  compatibilities: readonly CompatibilityPair[],
): string[] {
  const salida: string[] = [];
  for (const par of compatibilities) {
    if (par.spaceAId === spaceId) salida.push(par.spaceBId);
    else if (par.spaceBId === spaceId) salida.push(par.spaceAId);
  }
  return salida;
}

/**
 * Qué espacios ocupados tapan a este. **Se incluye a sí mismo**: un espacio siempre se
 * bloquea con sus propias reservas.
 *
 * Es lo que se le pasa al motor de disponibilidad para juntar la ocupación.
 */
export function blockingSpaceIds(
  spaceId: string,
  allSpaceIds: readonly string[],
  compatibilities: readonly CompatibilityPair[],
): string[] {
  const conviven = new Set(compatibleSpaceIds(spaceId, compatibilities));
  return allSpaceIds.filter((id) => id === spaceId || !conviven.has(id));
}

/** Los pares a guardar cuando el dueño elige con quiénes convive un espacio. */
export function pairsForSpace(
  spaceId: string,
  compatibleWith: readonly string[],
): CompatibilityPair[] {
  const vistos = new Set<string>();
  const salida: CompatibilityPair[] = [];
  for (const otro of compatibleWith) {
    if (otro === spaceId || vistos.has(otro)) continue;
    vistos.add(otro);
    salida.push(normalizePair(spaceId, otro));
  }
  return salida;
}
