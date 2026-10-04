import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";

/**
 * Texto del canal de ayuda por un cobro que el socio no reconoce.
 *
 * Módulo PURO. Existe porque el padrón se migró de otro sistema y una parte de los saldos
 * no reconcilia: hay que asumir que algunos socios van a ver un número que no es el suyo, y
 * darles una salida visible antes de que el reclamo llegue enojado.
 */

/** Lo que se lee en pantalla, arriba del botón. */
export const DUES_HELP_INVITE =
  "Si creés que hay un error en el cobro de tu cuota, escribinos por WhatsApp y lo ajustamos.";

/**
 * Mensaje que ya viene escrito en el chat.
 *
 * Se identifica solo: sin el número de socio, la Secretaría tiene que abrir una conversación
 * de ida y vuelta antes de poder mirar la ficha. Sin número disponible el mensaje se acorta
 * en vez de quedar cortado a la mitad.
 */
export function buildDuesHelpMessage(input: {
  memberNumber: string | null | undefined;
  vocabulary: PersonVocabulary;
}): string {
  const numero = input.memberNumber?.trim();
  if (!numero) return "Hola, tengo una consulta sobre el cobro de mi cuota.";
  return aplicarVocabulario(
    `Hola, soy el {persona} N° ${numero}. Tengo una consulta sobre el cobro de mi cuota.`,
    input.vocabulary,
  );
}
