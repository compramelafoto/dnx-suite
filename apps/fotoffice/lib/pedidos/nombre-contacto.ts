/** Nombre de un contacto para mostrar: razón social, o nombre y apellido; "Sin nombre" si no hay nada. */
export function nombreDeContacto(c: { firstName: string | null; lastName: string | null; businessName: string | null } | null | undefined): string {
  if (!c) return "Sin nombre";
  return c.businessName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Sin nombre";
}
