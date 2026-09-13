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
