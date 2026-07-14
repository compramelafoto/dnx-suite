/**
 * Une clases CSS de forma segura sin dependencias externas.
 */
export function cn(
  ...parts: Array<string | number | boolean | null | undefined>
): string {
  return parts.filter((part): part is string => typeof part === "string" && part.length > 0).join(" ");
}
