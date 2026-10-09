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

export type VeredictoDeMensaje =
  | { ok: true; texto: string; estadoInicial: "REVIEW_REQUIRED" }
  | { ok: false; motivo: string; estadoInicial: "REVIEW_REQUIRED" };

export function validarMensaje(crudo: string): VeredictoDeMensaje {
  const texto = limpiarMensaje(crudo);

  /*
    `estadoInicial` va en los dos casos y es siempre el mismo a propósito: quien llame a
    esto no tiene que elegir el estado, y no hay forma de olvidarse de ponerlo.
  */
  if (texto.length === 0) {
    return { ok: false, motivo: "Escribí algo antes de mandarlo.", estadoInicial: "REVIEW_REQUIRED" };
  }

  if (texto.length > LARGO_MAXIMO_MENSAJE) {
    return {
      ok: false,
      motivo: `El mensaje no puede pasar de ${LARGO_MAXIMO_MENSAJE} caracteres.`,
      estadoInicial: "REVIEW_REQUIRED",
    };
  }

  return { ok: true, texto, estadoInicial: "REVIEW_REQUIRED" };
}
