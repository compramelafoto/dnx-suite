/**
 * Siguiente número de socio disponible.
 *
 * El número es **de por vida y nunca se reutiliza**: aunque el 733 se haya dado de baja,
 * el siguiente es el 734. Reciclar un número mezclaría el historial de dos personas
 * distintas, que es justo lo que el padrón no puede permitirse.
 *
 * Los números con formato propio de la institución —"S-12", "honorario"— se ignoran para
 * el cálculo en vez de hacer fallar el alta: nadie debería quedar sin poder asociarse
 * porque hace diez años alguien cargó un número raro.
 *
 * **No garantiza unicidad por sí sola.** Quien la use debe hacerlo dentro de la
 * transacción de aprobación, con la restricción `[workspaceId, memberNumber]` como
 * árbitro: si dos aprobaciones simultáneas calculan el mismo número, una falla y reintenta.
 */
export function nextMemberNumber(existing: readonly string[]): string {
  let max = 0;
  for (const raw of existing) {
    const t = raw?.trim();
    if (!t || !/^\d+$/.test(t)) continue;
    const n = Number(t);
    if (Number.isSafeInteger(n) && n > max) max = n;
  }
  return String(max + 1);
}
