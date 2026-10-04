/**
 * El pedacito de URL de la página pública de un jurado.
 *
 * Vivía suelto dentro de judges.ts; se mudó acá porque ahora lo necesitan dos
 * caminos de alta, y tener dos versiones sería tener dos formas distintas de la
 * misma URL.
 */
import { randomBytes } from "node:crypto";

export function buildPublicSlug(firstName: string, lastName: string): string {
  return (
    `${firstName}-${lastName}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `jurado-${randomBytes(4).toString("hex")}`
  );
}

/** El slug con un sufijo al azar, para que dos homónimos no choquen. */
export function buildPublicSlugUnico(firstName: string, lastName: string): string {
  return `${buildPublicSlug(firstName, lastName)}-${randomBytes(2).toString("hex")}`;
}
