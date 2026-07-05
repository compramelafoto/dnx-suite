/**
 * Visibilidad de álbumes de fotógrafos en eventos colaborativos.
 * La convocatoria (visibility / joinPolicy del Event) solo regula quién puede sumarse;
 * no debe heredarse al álbum ni ocultar fotos ya publicadas por el fotógrafo.
 */
export const EVENT_PHOTOGRAPHER_ALBUM_DEFAULT_VISIBILITY = {
  isPublic: true,
  isHidden: false,
} as const;

export type EventPhotographerAlbumVisibilityInput = {
  isPublic?: boolean | null;
  isHidden?: boolean | null;
};

/**
 * Valores al crear o reparar un subálbum de evento.
 * Por defecto público y visible; el fotógrafo puede cambiarlo después desde su panel.
 */
export function resolveEventPhotographerAlbumVisibility(
  input: EventPhotographerAlbumVisibilityInput = {}
): { isPublic: boolean; isHidden: boolean } {
  return {
    isPublic: input.isPublic !== false,
    isHidden: Boolean(input.isHidden),
  };
}

/**
 * Al vincular un álbum a un evento (alta por convocatoria), forzar visibilidad comercial por defecto.
 * Ignora privacidad del evento (PRIVATE / INVITE_ONLY).
 */
export function eventPhotographerAlbumVisibilityForEventJoin(): {
  isPublic: boolean;
  isHidden: boolean;
} {
  return { ...EVENT_PHOTOGRAPHER_ALBUM_DEFAULT_VISIBILITY };
}

export function isEventPhotographerAlbumPubliclyAccessible(album: {
  isPublic?: boolean | null;
  isHidden?: boolean | null;
}): boolean {
  return album.isPublic === true && album.isHidden !== true;
}
