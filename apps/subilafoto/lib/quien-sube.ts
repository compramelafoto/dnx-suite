/**
 * Quién puede elegir varias fotos de una sola vez en la pantalla del invitado.
 *
 * **El invitado elige una por vez**, a propósito. Con el selector múltiple, el camino más
 * corto para un invitado es abrir la galería, marcar todo y mandar el carrete entero:
 * cincuenta fotos del día anterior, capturas de pantalla y lo que haya. Eso tapa la
 * pantalla del salón, se come el tope de subidas de esa persona y le deja al fotógrafo
 * medio centenar de cosas para revisar de a una.
 *
 * No se lo prohíbe: puede subir las que quiera, una tras otra. Lo que cambia es que
 * volcar la galería pasa a ser deliberado en vez de ser el camino fácil.
 *
 * **El organizador sí las elige de a muchas**: está cargando el material del evento, no
 * mandando un saludo.
 *
 * Es sólo el atributo `multiple` del selector de archivos, y alcanza porque el servidor
 * ya recibe una foto por pedido y aplica `maxUploadsPerGuest`. No es una barrera de
 * seguridad; es el diseño del camino.
 */

export type QuienSube = {
  /** Usuario con sesión de la suite, o `null` si entró por el QR sin cuenta. */
  usuarioId: number | null;
  /** Dueño del perfil de venta del evento. */
  duenoId: number | null;
};

export function puedeElegirVarias({ usuarioId, duenoId }: QuienSube): boolean {
  // Ante la duda, la regla del invitado: es la que no puede tapar la pantalla.
  if (usuarioId == null || duenoId == null) return false;

  // Tener cuenta en la suite no es ser el organizador de ESTE evento.
  return usuarioId === duenoId;
}
