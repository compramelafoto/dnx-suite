import { Role } from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma";

/** Valor por defecto de `Template.version` para filas del diseñador legacy. */
export const TEMPLATE_LEGACY_ROW_VERSION_DEFAULT = "v1";

/**
 * Restricción de listado API: fotógrafos/lab solo reciben filas con `version: "v2"`.
 * Hoy las plantillas legacy existentes son `v1`, así que el listado queda vacío y el flujo va a Template V2.
 */
export function legacyTemplateListWhereForRole(role: Role): Prisma.TemplateWhereInput | undefined {
  if (role === Role.ADMIN) return undefined;
  return { version: "v2" };
}
