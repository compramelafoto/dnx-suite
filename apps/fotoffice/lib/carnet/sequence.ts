/**
 * Siguiente número de carnet del año.
 *
 * A diferencia del número de socio, **este sí se reinicia cada año**: identifica una emisión,
 * no a una persona, y `C-2026-0001` se lee mejor que `C-8471`.
 *
 * **No garantiza unicidad por sí sola.** Quien la use debe hacerlo dentro de una transacción,
 * con la restricción `[workspaceId, cardNumber]` como árbitro: si dos emisiones simultáneas
 * calculan el mismo número, una falla y reintenta.
 */
export function nextCardSequence(existing: readonly string[], year: number): number {
  const prefijo = `C-${year}-`;
  let max = 0;
  for (const raw of existing) {
    const t = raw?.trim();
    if (!t || !t.startsWith(prefijo)) continue;
    const cola = t.slice(prefijo.length);
    if (!/^\d+$/.test(cola)) continue;
    const n = Number(cola);
    if (Number.isSafeInteger(n) && n > max) max = n;
  }
  return max + 1;
}
