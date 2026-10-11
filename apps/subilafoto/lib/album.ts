/**
 * Qué contenido de un evento es público.
 *
 * Una foto llega a la pantalla y al álbum sólo si se cumplen **dos** cosas:
 * está aprobada y tiene fecha de publicación. Ninguna de las dos alcanza sola.
 *
 * `publishedAt` es lo que de verdad manda. El estado dice qué decidió la
 * moderación; la fecha dice que se publicó. Cuando el dueño del evento oculta
 * una foto, se borra la fecha — y por eso desaparece de todos lados sin que
 * haya que acordarse de filtrarla en cada consulta.
 */

export type FotoParaMostrar = {
  status: string;
  publishedAt: Date | null;
};

export function estaPublicada(foto: FotoParaMostrar): boolean {
  return foto.status === "APPROVED" && foto.publishedAt !== null;
}

/**
 * El `where` de Prisma para traer sólo lo publicado de un evento.
 *
 * Vive acá y no suelto en cada pantalla: la galería, la pantalla del salón y el
 * paquete de descarga tienen que coincidir exactamente. Si una de las tres
 * filtrara distinto, habría contenido visible en un lado y no en otro.
 */
export function condicionDePublicadas(eventoId: string) {
  return {
    eventId: eventoId,
    status: "APPROVED" as const,
    publishedAt: { not: null },
  };
}

/**
 * ¿Esta persona puede ver el álbum?
 *
 * El interruptor `guestsCanSeeAlbum` es sobre los **invitados**: hay organizadores que no
 * quieren que la fiesta entera vea las fotos antes que ellos. Al cliente que contrató el
 * evento no lo alcanza — es su material, y su enlace ya es la prueba de quién es.
 */
export function puedeVerElAlbum(entrada: {
  guestsCanSeeAlbum: boolean;
  esElCliente: boolean;
}): boolean {
  return entrada.esElCliente || entrada.guestsCanSeeAlbum;
}

/**
 * ¿Se puede ver el muro en vivo?
 *
 * **No es el álbum, y la diferencia es el punto.** El álbum es todo lo del evento, para
 * siempre, con la foto entera: por eso nace cerrado a los invitados. El muro es lo que
 * está llegando **ahora**, en chico, mientras la fiesta pasa, y se apaga cuando el evento
 * cierra.
 *
 * Existe por la fiesta del 10/10/2026, que no se hizo porque el salón no tenía pantalla.
 * Sin pantalla, el invitado escanea, sube una foto y no recibe absolutamente nada: la
 * manda a un pozo. El muro es la pantalla del salón cuando no hay pantalla.
 *
 * Nace **encendido**, al revés que el álbum, porque sin él una fiesta sin televisor no
 * funciona. El fotógrafo que prefiere que el salón mire hacia arriba lo apaga.
 */
export function puedeVerElMuro(entrada: {
  guestsCanSeeLive: boolean;
  /** `ABIERTO` sólo mientras el evento corre. Ver `lib/acceso-evento.ts`. */
  momento: "ANTES" | "ABIERTO" | "CERRADO";
}): boolean {
  // Terminada la fiesta no hay nada "en vivo" que mostrar: ahí manda el álbum.
  return entrada.guestsCanSeeLive && entrada.momento === "ABIERTO";
}
