/**
 * Laboratorios «del sistema» que cargó DNX sin que el laboratorio tenga cuenta todavía.
 *
 * Aparecen sólo en el directorio de «Mis laboratorios» del fotógrafo (para mandarles lotes por
 * correo y retirar ahí). No aparecen en la compra del cliente final, en la elección de laboratorio
 * del álbum ni en el directorio público, porque no pueden recibir ni cobrar pedidos.
 *
 * Cuando el laboratorio se registra con ese mismo correo, toma este registro y se le quita la marca.
 */
export const LAB_TAG_SOLO_DIRECTORIO = "solo-directorio";

/** Filtro de Prisma que deja afuera a los laboratorios sólo de directorio. */
export const SIN_LABS_SOLO_DIRECTORIO = {
  NOT: { tags: { has: LAB_TAG_SOLO_DIRECTORIO } },
} as const;

export function esLabSoloDirectorio(lab: { tags?: string[] | null; userId?: number | null }): boolean {
  return (lab.tags ?? []).includes(LAB_TAG_SOLO_DIRECTORIO) && !lab.userId;
}
