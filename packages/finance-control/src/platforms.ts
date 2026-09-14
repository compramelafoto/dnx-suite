/** Plataformas de la suite. `suite` es el gasto de estructura no atribuible. */
export const PLATFORM_KEYS = [
  "clf",
  "fotoffice",
  "fotorank",
  "clickaton",
  "infospot",
  "suite",
] as const;

export type PlatformKey = (typeof PLATFORM_KEYS)[number];

export function isPlatformKey(value: string): value is PlatformKey {
  return (PLATFORM_KEYS as readonly string[]).includes(value);
}
