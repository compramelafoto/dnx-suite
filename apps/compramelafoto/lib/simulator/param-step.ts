/** Avanza o retrocede un valor dentro de una lista de presets (pasos de luz). */
export function stepOption<T>(
  options: readonly T[],
  current: T,
  delta: -1 | 1,
  compare: (a: T, b: T) => boolean = defaultCompare,
): T | null {
  const index = options.findIndex((opt) => compare(opt, current));
  if (index < 0) return null;
  const next = index + delta;
  if (next < 0 || next >= options.length) return null;
  return options[next];
}

export function defaultCompare<T>(a: T, b: T): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Number.isInteger(a) ? a === b : Math.abs(a - b) < 0.01;
  }
  return a === b;
}
