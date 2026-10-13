/**
 * Quién puede administrar un evento.
 *
 * Hasta el 2026-10-10 la respuesta era una sola —el dueño del perfil de venta— y estaba
 * escrita a mano en diecisiete lugares: cada pantalla del panel, cada acción y cada
 * endpoint repetían `sellerProfile: { userId }`. Diecisiete copias de un criterio de
 * seguridad es cuestión de tiempo hasta que una quede distinta de las otras.
 *
 * La tabla `SubilafotoCollaborator` existía desde el principio, con sus roles y todo, y
 * **no la leía nadie**. Agregarle una fila a alguien no le daba acceso a nada: entraba y
 * no veía ningún evento.
 *
 * Ahora hay una sola puerta y los dos caminos pasan por acá.
 *
 * **Es aditivo a propósito.** El `OR` deja la rama del dueño intacta: lo único que se suma
 * es exactamente la gente que tenga una fila de colaboración viva para ESE evento. Nadie
 * pierde acceso y nadie gana acceso a un evento ajeno.
 */

/** Una colaboración cuenta mientras no haya sido revocada. */
const VIVA = { revokedAt: null };

/**
 * El `where` para traer UN evento que esta persona puede administrar.
 *
 * Va en el `where` y no en un `if` posterior: así una consulta que no corresponde
 * devuelve "no encontrado" en vez de traer el dato y confiar en que alguien se acuerde
 * de mirarlo después.
 */
export function eventoQueAdministra(eventoId: string, usuarioId: number) {
  return {
    id: eventoId,
    OR: [
      { sellerProfile: { userId: usuarioId } },
      { collaborators: { some: { userId: usuarioId, ...VIVA } } },
    ],
  };
}

/** Lo mismo pero anidado, para cuando se consulta una foto y se pregunta por su evento. */
export function medioDeUnEventoQueAdministra(
  mediaId: string,
  eventoId: string,
  usuarioId: number,
) {
  return {
    id: mediaId,
    eventId: eventoId,
    event: {
      OR: [
        { sellerProfile: { userId: usuarioId } },
        { collaborators: { some: { userId: usuarioId, ...VIVA } } },
      ],
    },
  };
}

/**
 * El `where` para LISTAR los eventos de alguien.
 *
 * Son los de su propio perfil más aquellos en los que lo invitaron. Sin esto, quien
 * colabora entra al panel y ve una lista vacía, aunque tenga permiso en cada pantalla.
 */
export function eventosQueAdministra(perfilId: string, usuarioId: number) {
  return {
    OR: [
      { sellerProfileId: perfilId },
      { collaborators: { some: { userId: usuarioId, ...VIVA } } },
    ],
  };
}
