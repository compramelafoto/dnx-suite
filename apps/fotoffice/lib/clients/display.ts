/**
 * El nombre con el que se muestra un cliente. Módulo PURO.
 *
 * Nunca devuelve una cadena vacía: una fila en blanco en el listado es un cliente que
 * existe y no se puede seleccionar, que es peor que un cliente mal nombrado.
 */
export function clientDisplayName(c: {
  kind: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}): string {
  if (c.kind === "EMPRESA") return c.businessName?.trim() || "Sin razón social";
  const apellido = c.lastName?.trim() ?? "";
  const nombre = c.firstName?.trim() ?? "";
  if (apellido && nombre) return `${apellido}, ${nombre}`;
  return apellido || nombre || "Sin nombre";
}
