/**
 * Cómo se llama la gente del padrón en cada workspace.
 *
 * El módulo de Socios se escribió para la SFPR, que tiene socios de verdad, y la palabra
 * quedó escrita en 48 archivos. Foto Positiva tiene voluntarios; una agencia tendría
 * colaboradores; una escuela, alumnos. FotoOffice promete ser modular y multi-workspace, y
 * esa promesa no se cumple si cada institución tiene que hablar en el idioma de otra.
 *
 * **Se configuran dos formas, no cuatro.** Singular y plural; las mayúsculas se derivan.
 * Pedirle a alguien que cargue "socio", "socios", "Socio" y "Socios" es pedirle que se
 * equivoque en una y no se entere hasta que la vea en pantalla.
 *
 * Módulo puro, sin Prisma ni `server-only`: lo importan tanto pantallas de servidor como
 * componentes cliente.
 */

/** Lo que viene de la base. Nulo en todo workspace que nunca lo tocó. */
export type PersonTerms = {
  singular?: string | null;
  plural?: string | null;
};

/**
 * Lo que rige para quien no configuró nada.
 *
 * Son las palabras que el sistema usa hoy en todas sus pantallas, así que la SFPR y
 * cualquier workspace existente siguen leyéndose exactamente igual que antes.
 */
export const DEFAULT_PERSON_TERMS: Required<PersonTerms> = {
  singular: "socio",
  plural: "socios",
};

/** Las cuatro formas que las pantallas necesitan. */
export type PersonVocabulary = {
  singular: string;
  plural: string;
  Singular: string;
  Plural: string;
};

/**
 * Mayúscula inicial, y nada más.
 *
 * `toUpperCase()` sobre la palabra entera convertiría "voluntario/a" en "VOLUNTARIO/A", y
 * capitalizar cada palabra convertiría "socio de honor" en "Socio De Honor". Solo la primera
 * letra.
 */
function conMayusculaInicial(palabra: string): string {
  if (!palabra) return palabra;
  return palabra.charAt(0).toUpperCase() + palabra.slice(1);
}

/** Una palabra vacía no pisa la de por omisión: dejaría la pantalla sin la palabra. */
function usar(configurada: string | null | undefined, porOmision: string): string {
  return configurada?.trim() || porOmision;
}

/**
 * El vocabulario de un workspace.
 *
 * Nunca devuelve una cadena vacía: si falta una de las dos formas, esa vuelve a la de por
 * omisión y la otra se respeta. Quien escribió el singular y se olvidó del plural no queda
 * con media pantalla en blanco.
 */
export function personVocabulary(terms: PersonTerms | null | undefined): PersonVocabulary {
  const singular = usar(terms?.singular, DEFAULT_PERSON_TERMS.singular);
  const plural = usar(terms?.plural, DEFAULT_PERSON_TERMS.plural);
  return {
    singular,
    plural,
    Singular: conMayusculaInicial(singular),
    Plural: conMayusculaInicial(plural),
  };
}
