/**
 * A quién le toca. Módulo puro: recibe quiénes pueden salir y lo que ya pasó, y decide.
 *
 * Reglas (diseño 2026-10-04):
 * - Entran todos los socios activos.
 * - Nadie se repite dentro de una vuelta. Un salteado cuenta como "ya pasó" en esa vuelta: si
 *   pidió no salir, no tiene sentido volver a elegirlo la semana siguiente.
 * - Cuando ya pasaron todos, empieza una vuelta nueva. Quien se asocia en el medio entra en la
 *   vuelta en curso, porque no figura entre los que ya pasaron.
 * - Al empezar una vuelta nueva no se elige al de la semana anterior: dos semanas seguidas la
 *   misma persona parecería un error, aunque las reglas lo permitan.
 */

export type SpotlightHistoryRow = {
  memberId: string;
  round: number;
  weekStart: Date;
  skipped: boolean;
};

export type PickResult = { memberId: string; round: number } | null;

export function pickSpotlight(input: {
  candidates: readonly string[];
  history: readonly SpotlightHistoryRow[];
  /** Ids que no pueden salir en esta elección (p. ej. el que se acaba de saltear). */
  exclude?: readonly string[];
  /** Un número en [0, 1). Se inyecta para poder probar; en producción, criptográfico. */
  random: () => number;
}): PickResult {
  const excluidos = new Set(input.exclude ?? []);
  const candidatos = [...new Set(input.candidates)].filter((id) => !excluidos.has(id));
  if (candidatos.length === 0) return null;

  const vuelta = input.history.reduce((max, h) => Math.max(max, h.round), 1);
  const yaPasaron = new Set(input.history.filter((h) => h.round === vuelta).map((h) => h.memberId));
  const pendientes = candidatos.filter((id) => !yaPasaron.has(id));

  if (pendientes.length > 0) {
    return { memberId: elegir(pendientes, input.random), round: vuelta };
  }

  // Vuelta nueva. Se evita repetir al último que salió de verdad, salvo que sea el único.
  const ultimo = [...input.history]
    .filter((h) => !h.skipped)
    .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())[0]?.memberId;
  const nuevaVuelta = candidatos.length > 1 ? candidatos.filter((id) => id !== ultimo) : candidatos;
  return { memberId: elegir(nuevaVuelta, input.random), round: vuelta + 1 };
}

function elegir(ids: readonly string[], random: () => number): string {
  // Orden fijo antes de sortear: el resultado depende sólo del número al azar, no del orden en
  // que la base devolvió las filas.
  const ordenados = [...ids].sort();
  const i = Math.min(ordenados.length - 1, Math.floor(random() * ordenados.length));
  return ordenados[i];
}
