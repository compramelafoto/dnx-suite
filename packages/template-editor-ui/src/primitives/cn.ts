/** Une clases de Tailwind descartando valores vacíos. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
