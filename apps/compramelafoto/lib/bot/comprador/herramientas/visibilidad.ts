import { isAlbumPubliclyAccessible, isAlbumUnlistedWithDirectLink } from "@/lib/album-helpers";
import type { CompradorActor } from "../identidad";

export type AlbumVisible = { id: number; isPublic: boolean | null; isHidden: boolean | null };

/**
 * Se ve si es público o si es el álbum de la página donde está la persona y esa página lo muestra:
 * no listado con link directo. Un álbum oculto (`isHidden`) no: `/a/[id]` y `/album/[slug]` bloquean
 * la galería (sólo ofrecen pedir la reactivación), y `a.albumId` sale de un `pagePath` que manda el navegador.
 * Única regla para todas las herramientas del comprador.
 */
export function albumVisiblePara(a: Pick<CompradorActor, "albumId">, album: AlbumVisible | null): boolean {
  if (!album) return false;
  return isAlbumPubliclyAccessible(album) || (album.id === a.albumId && isAlbumUnlistedWithDirectLink(album));
}
