/**
 * Qué pregunta toca cada día: todas las personas ven la misma ese día (hora
 * argentina) y se recorren las 200 en un orden mezclado fijo, así no se repite
 * ninguna hasta dar la vuelta completa.
 */

/** Fecha "AAAA-MM-DD" en Buenos Aires. */
export function argentinaDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Días transcurridos desde el 1/1/2026 para una fecha "AAAA-MM-DD". */
export function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86_400_000);
}

/** Números pseudoaleatorios con semilla (mulberry32): mismo orden en todas las máquinas. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Orden mezclado de 0..total-1 (Fisher–Yates con semilla). */
export function shuffledOrder(total: number, seed = 2026): number[] {
  const order = Array.from({ length: total }, (_, i) => i);
  const rand = seeded(seed);
  for (let i = total - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Índice de la pregunta del día. */
export function questionIndexForDay(dateKey: string, total: number): number {
  const order = shuffledOrder(total);
  const n = ((dayNumber(dateKey) % total) + total) % total;
  return order[n];
}

/** Otra pregunta al azar, distinta de la actual. */
export function randomOtherIndex(current: number, total: number, rand: () => number = Math.random): number {
  if (total < 2) return current;
  const pick = Math.floor(rand() * (total - 1));
  return pick >= current ? pick + 1 : pick;
}
