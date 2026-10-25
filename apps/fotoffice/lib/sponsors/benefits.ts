/**
 * Qué cuenta como beneficio para el socio.
 *
 * El beneficio es el título y el texto de la participación del sponsor en la institución: lo
 * carga la marca desde su enlace de autoalta o la institución desde la ficha del sponsor
 * («Lo que muestra la institución»). Sin título ni texto no hay nada que ofrecerle al socio, y
 * el sponsor no entra a Beneficios aunque esté vinculado.
 *
 * No usa el espacio `FOTOFFICE_BENEFIT_CARD` de DNX Partners a propósito: ese espacio admite un
 * solo sponsor a la vez, y Beneficios es el listado de todos los convenios vigentes.
 */

export type BenefitText = { title: string | null; description: string | null };

export function tieneBeneficio(p: BenefitText): boolean {
  return Boolean(p.title?.trim() || p.description?.trim());
}

/** Orden del listado: por nombre de la marca, como lo busca el socio, sin importar mayúsculas ni tildes. */
export function compararPorMarca(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
}
