import type { PersonVocabulary } from "./personas";

/**
 * Sustituye los marcadores de vocabulario de un texto.
 *
 * Existe por el catálogo de módulos: el menú lateral y el inicio del workspace sacan sus
 * etiquetas de `lib/modules/registry.ts` y `lib/modules/submodules.ts`, que son globales y no
 * saben en qué workspace está parado quien mira.
 *
 * La alternativa obvia —buscar "socio" en el texto y reemplazarlo— **destrozaría frases**:
 * "asociación" y "asociarse" contienen "socia", y quedarían convertidas en cualquier cosa. Por
 * eso los textos llevan marcadores explícitos y solo se sustituye lo que está marcado.
 *
 * Un marcador desconocido se deja tal cual, visible. Borrarlo dejaría una frase incompleta que
 * nadie notaría; dejarlo salta a la vista en la primera mirada.
 */
export function aplicarVocabulario(texto: string, v: PersonVocabulary): string {
  return texto
    .replaceAll("{Personas}", v.Plural)
    .replaceAll("{personas}", v.plural)
    .replaceAll("{Persona}", v.Singular)
    .replaceAll("{persona}", v.singular);
}
