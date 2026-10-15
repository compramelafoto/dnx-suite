/** Cookie con la pantalla a la que vuelve el diseñador al cerrarse. */
export const DESIGNER_RETURN_COOKIE = "fotorank_designer_return";

/** Sólo rutas internas del panel: nunca una dirección de otro sitio (redirección abierta). */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/dashboard/") || value.startsWith("//") || value.includes("\\")) return null;
  if (value.length > 300) return null;
  return value;
}
