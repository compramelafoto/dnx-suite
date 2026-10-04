import { DEFAULT_PERSON_TERMS } from "./personas";

/**
 * Qué se puede escribir en la pantalla donde cada institución elige sus palabras.
 *
 * Las reglas viven acá, puras y probadas, y no dentro de la server action: son lo único que
 * separa el vocabulario de un workspace de una pantalla rota. Un `required` en el HTML no
 * sirve de control —una server action es alcanzable por POST directo— y además deja sin
 * probar el caso que importa.
 *
 * Tres decisiones que no son obvias:
 *
 * 1. **Los dos campos vacíos es una respuesta válida**, y significa "volver a socio/socios".
 *    Se devuelve `terminos: null` y quien llama borra la fila. Lo que NO puede pasar es que
 *    quede una fila con cadenas vacías: `personVocabulary` las trataría como configuradas y
 *    la pantalla se quedaría sin la palabra.
 *
 * 2. **O las dos o ninguna.** `personVocabulary` tolera que falte una —vuelve a la de por
 *    omisión— porque es la red de seguridad de las pantallas, pero como respuesta de un
 *    formulario "voluntario/a" + "socios" es casi siempre un olvido, no una decisión. Vale
 *    más devolverlo que guardarlo mezclado.
 *
 * 3. **Las llaves están prohibidas.** El texto del sistema lleva marcadores `{personas}`, y
 *    una palabra que contenga llaves los volvería a meter en el texto ya sustituido.
 */

/** Suficiente para "voluntarios/as" o "socios de honor"; corto para que entre en un menú. */
export const PALABRA_MAX = 40;

export type PalabrasCrudas = {
  singular: string | null | undefined;
  plural: string | null | undefined;
};

/** Lo que hay que guardar, o `null` para borrar la fila y volver a socio/socios. */
export type PalabrasValidas = { singular: string; plural: string } | null;

export type ResultadoValidacion =
  | { ok: true; terminos: PalabrasValidas }
  | { ok: false; error: string };

/** Los saltos de línea y los caracteres de control no llegan por el formulario, sí por un POST. */
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

function limpiar(valor: string | null | undefined): string {
  return (valor ?? "").trim();
}

function revisarUna(palabra: string, cual: "singular" | "plural"): string | null {
  const comoSeLlama = cual === "singular" ? "La palabra en singular" : "La palabra en plural";
  if (palabra.length > PALABRA_MAX) {
    return `${comoSeLlama} no puede superar los ${PALABRA_MAX} caracteres.`;
  }
  if (palabra.includes("{") || palabra.includes("}")) {
    return `${comoSeLlama} no puede llevar llaves: el sistema las usa para marcar dónde va la palabra.`;
  }
  if (CONTROL_RE.test(palabra)) {
    return `${comoSeLlama} tiene que ser una sola línea de texto.`;
  }
  return null;
}

/**
 * Valida lo que escribió la persona y devuelve lo que corresponde guardar.
 *
 * No decide nada sobre permisos ni sobre la base: eso es de la server action.
 */
export function validarPalabras(entrada: PalabrasCrudas): ResultadoValidacion {
  const singular = limpiar(entrada.singular);
  const plural = limpiar(entrada.plural);

  // Vaciar los dos campos es la forma de volver atrás, y tiene que ser fácil.
  if (!singular && !plural) return { ok: true, terminos: null };

  if (!singular || !plural) {
    return {
      ok: false,
      error:
        "Escribí las dos formas, la singular y la plural. Si querés volver a " +
        `${DEFAULT_PERSON_TERMS.singular} y ${DEFAULT_PERSON_TERMS.plural}, dejá los dos campos vacíos.`,
    };
  }

  const problema = revisarUna(singular, "singular") ?? revisarUna(plural, "plural");
  if (problema) return { ok: false, error: problema };

  return { ok: true, terminos: { singular, plural } };
}
