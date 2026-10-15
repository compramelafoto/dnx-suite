/**
 * Los mensajes que el invitado deja para que se proyecten en el salón.
 *
 * La puerta prometía "subí tus fotos **y dejá tu mensaje**" desde el principio, y el
 * enum de la base tenía `MESSAGE`, pero no había una sola línea que los creara ni los
 * mostrara: era una promesa que el producto no cumplía.
 *
 * **Un mensaje no es un emoji.** El emoji pasa sin moderar porque la lista es cerrada y
 * no puede decir nada; un texto proyectado en la pared de un salón puede decir cualquier
 * cosa. Rekognition mira imágenes, no juzga texto. Así que el mensaje **espera siempre al
 * fotógrafo**, igual que una foto que la moderación retuvo.
 */

/**
 * Ciento cuarenta caracteres.
 *
 * No es por el costo: es por la pantalla. Un párrafo proyectado a tres metros no lo lee
 * nadie, y siete segundos no alcanzan. Lo que entra es un saludo.
 */
export const LARGO_MAXIMO_MENSAJE = 140;

/**
 * Deja el texto como se va a proyectar.
 *
 * Los caracteres de control se van: son invisibles, rompen el dibujo del texto y algunos
 * —como `U+202E`— lo dan vuelta de derecha a izquierda. Los espacios y saltos repetidos
 * se colapsan: sin eso, veinte saltos de línea hacen que un mensaje ocupe la pantalla
 * entera y empuje todo lo demás afuera.
 *
 * Los acentos, la eñe y los emojis se quedan: es un saludo de fiesta, no un identificador.
 */
export function limpiarMensaje(texto: string): string {
  return texto
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Con qué estado nace un mensaje.
 *
 * **Decisión del titular, 2026-10-09: sin cola de revisión manual.** Era
 * `REVIEW_REQUIRED` y esperaba al fotógrafo, porque Amazon mira imágenes y no juzga
 * texto. Ahora se proyecta solo.
 *
 * Lo que eso significa: **un texto escrito por un invitado aparece en la pared del salón
 * sin que nadie lo haya leído**. Lo único que lo acota es que son 140 caracteres y que
 * queda guardado con la sesión de quien lo mandó. El fotógrafo lo puede sacar desde
 * Control en vivo, pero después de que se vio.
 */
const ESTADO_INICIAL = "APPROVED" as const;

export type VeredictoDeMensaje =
  | { ok: true; texto: string; estadoInicial: typeof ESTADO_INICIAL }
  | { ok: false; motivo: string; estadoInicial: typeof ESTADO_INICIAL };

export function validarMensaje(crudo: string): VeredictoDeMensaje {
  const texto = limpiarMensaje(crudo);

  /*
    `estadoInicial` va en los dos casos y es siempre el mismo a propósito: quien llame a
    esto no tiene que elegir el estado, y no hay forma de olvidarse de ponerlo.
  */
  if (texto.length === 0) {
    return { ok: false, motivo: "Escribí algo antes de mandarlo.", estadoInicial: ESTADO_INICIAL };
  }

  if (texto.length > LARGO_MAXIMO_MENSAJE) {
    return {
      ok: false,
      motivo: `El mensaje no puede pasar de ${LARGO_MAXIMO_MENSAJE} caracteres.`,
      estadoInicial: ESTADO_INICIAL,
    };
  }

  return { ok: true, texto, estadoInicial: ESTADO_INICIAL };
}
