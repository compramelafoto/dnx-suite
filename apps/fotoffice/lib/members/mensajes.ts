import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";

/**
 * Los mensajes del padrón que nombran a la gente, en un solo lugar.
 *
 * Existen dos motivos para que vivan acá y no sueltos en cada archivo:
 *
 * 1. **La palabra es de cada institución.** Un error que dice "Socio no encontrado" en Foto
 *    Positiva, donde nadie es socio de nada, delata que el sistema es de otro. Los textos
 *    llevan marcadores y se resuelven con el vocabulario del workspace.
 *
 * 2. **Estaban duplicados.** `friendlyLinkError` existía palabra por palabra en
 *    `app/actions/member-access.ts` y en `lib/members/invite-member.ts`. Dos copias del mismo
 *    texto es una copia que alguien va a olvidarse de cambiar.
 *
 * Con el vocabulario por omisión, cada mensaje dice **exactamente** lo que decía antes: eso
 * es lo que verifica `mensajes.test.ts`, y es lo que garantiza que la SFPR no note nada.
 *
 * El género queda pendiente y es deuda conocida: "{Persona} no encontrado" con la palabra
 * "voluntaria" da una concordancia mal. Se resuelve el día que el vocabulario tenga género;
 * no se arregla reescribiendo cada frase a mano.
 */
export const MENSAJES_DE_PADRON = {
  invalido: "{Persona} inválido.",
  noEncontrado: "{Persona} no encontrado.",
  yaVinculado: "Este {persona} ya tiene una cuenta vinculada.",
  cuentaTomada: "Esa cuenta ya está vinculada a otro {persona} de este workspace.",
  cuentaTomadaEnEstaInstitucion:
    "Tu cuenta ya está vinculada a otro {persona} de esta institución.",
  soloSePuedeInvitarActivo: "Solo se puede invitar a un {persona} activo.",
  modificadoMientrasTanto:
    "Otra persona modificó este {persona} mientras tanto. Recargá la ficha e intentá de nuevo.",
  modificadoMientrasEditabas:
    "Otra persona modificó este {persona} mientras lo editabas. Recargá la ficha e intentá de nuevo.",
  sinEmail:
    "Este {persona} no tiene email. Cargale un email propio en su ficha, o vinculá una cuenta existente.",
  sinCuentaVinculada: "Este {persona} no tiene ninguna cuenta vinculada.",
  cuentaNoEncontrada:
    "No encontramos una cuenta con ese email exacto. Revisá el email o invitá al {persona}.",
  emailsNoCoinciden:
    "Los emails no coinciden: confirmá que esta es realmente la cuenta del {persona} antes de continuar.",
  motivoDeSuspension:
    "Escribí el motivo de la suspensión: queda registrado en el historial del {persona}.",
  motivoDeBaja: "Escribí el motivo de la baja: queda registrado en el historial del {persona}.",
  motivoDeDesvinculacion:
    "Escribí el motivo de la desvinculación: queda registrado en el historial del {persona}.",
  ningunoSeleccionado: "No seleccionaste ningún {persona}.",
  numeroRepetido: "Ya existe un {persona} con ese número en este workspace.",
  documentoRepetido: "Ya existe un {persona} con ese documento en este workspace.",
  emailRepetido: "Ya existe un {persona} con ese email en este workspace.",
  datosRepetidos: "Ya existe un {persona} con esos datos en este workspace.",
  noSePudoGuardar: "No se pudo guardar el {persona}.",
  elegiUno: "Elegí a qué {persona} corresponde el pago.",
  fichaNoEncontrada: "No encontramos tu ficha de {persona}.",
  condicionNoActiva: "Tu condición de {persona} no está activa.",
  fichaNoActiva: "Tu ficha de {persona} no está activa.",
  noPerteneceAEstaInstitucion: "Ese {persona} no pertenece a esta institución.",
  emailTomadoPorOtro:
    "Ese email ya está registrado en otro {persona} de este workspace. Usá otro email o dejá esta fila sin email.",
  numeroDuplicadoEnElArchivo: "Número de {persona} duplicado en el archivo.",
  choqueAlImportar:
    "No pudimos importar (algún dato choca con otro {persona} existente). No se creó ningún {persona}.",
} as const;

export type ClaveDeMensaje = keyof typeof MENSAJES_DE_PADRON;

/** El mensaje, ya con la palabra de esta institución. */
export function mensajeDePadron(clave: ClaveDeMensaje, vocabulary: PersonVocabulary): string {
  return aplicarVocabulario(MENSAJES_DE_PADRON[clave], vocabulary);
}
