/**
 * A quién le toca. Módulo puro.
 *
 * La persona es el email en minúsculas (así Clickatón une a alguien entre ediciones). Reglas:
 * - nadie se repite dentro de una vuelta; un salteado cuenta como que ya pasó;
 * - cuando pasaron todos, vuelta nueva, sin repetir al último que salió;
 * - quien entra en el medio (una edición nueva publica resultados) se suma a la vuelta en curso.
 */

export type ClickatonerHistoryRow = {
  email: string;
  round: number;
  weekStart: Date;
  skipped: boolean;
};

export function pickClickatoner(input: {
  candidates: readonly string[];
  history: readonly ClickatonerHistoryRow[];
  exclude?: readonly string[];
  random: () => number;
}): { email: string; round: number } | null {
  const excluidos = new Set(input.exclude ?? []);
  const candidatos = [...new Set(input.candidates)].filter((e) => !excluidos.has(e));
  if (candidatos.length === 0) return null;

  const vuelta = input.history.reduce((max, h) => Math.max(max, h.round), 1);
  const yaPasaron = new Set(input.history.filter((h) => h.round === vuelta).map((h) => h.email));
  const pendientes = candidatos.filter((e) => !yaPasaron.has(e));
  if (pendientes.length > 0) return { email: elegir(pendientes, input.random), round: vuelta };

  const ultimo = [...input.history]
    .filter((h) => !h.skipped)
    .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())[0]?.email;
  const nueva = candidatos.length > 1 ? candidatos.filter((e) => e !== ultimo) : candidatos;
  return { email: elegir(nueva, input.random), round: vuelta + 1 };
}

function elegir(ids: readonly string[], random: () => number): string {
  const ordenados = [...ids].sort();
  // Quien llama garantiza al menos uno; el `?? ""` sólo calma al compilador.
  return ordenados[Math.min(ordenados.length - 1, Math.floor(random() * ordenados.length))] ?? "";
}
