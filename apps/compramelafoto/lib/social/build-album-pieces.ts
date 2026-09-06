import type { MentionCandidate } from "@repo/social-publisher";
import type { SocialPieceSpec } from "@repo/social-pieces";
import {
  ALBUM_STORY_DOCUMENT,
  ALBUM_VARIABLE_CONTRACT,
  albumCarouselDocument,
} from "./album-piece-templates";

/**
 * Armado de las piezas sociales del álbum: copy, menciones y las dos `SocialPieceSpec`
 * (carrusel + historia) listas para `renderSocialPiece` (`@repo/social-pieces`).
 */

export type AlbumSocialData = {
  albumId: number;
  albumName: string;
  eventDate: Date | null;
  publicSlug: string;
  photographerHandle: string | null;
  organizerHandle: string | null;
  sponsorHandles: string[];
  /**
   * Ya con marca de agua (`Photo.previewWatermarkedKey` resuelto con `getPublicUrl`), en
   * orden de selección: es el orden del carrusel. Publicar el original en alta sería
   * regalar el producto que se vende.
   */
  photoUrls: string[];
};

export const PLATFORM_HANDLE = "compramelafoto";

/** Densidad a la que se pide el PNG: la misma con la que el documento declara sus píxeles.
 * Sin esto, `emitDesign` usa 300dpi por defecto y el PNG sale casi 4 veces más grande que
 * el 1080×1350 / 1080×1920 que declaran los documentos. */
const SCREEN_PNG_DPI = 96;

export function albumPublicUrl(slug: string): string {
  return `compramelafoto.com/a/${slug}`;
}

export function buildAlbumCaption(datos: AlbumSocialData): string {
  const lineas = [
    `📸 ${datos.albumName}`,
    "",
    "Las fotos ya están disponibles. Buscá las tuyas y llevátelas:",
    albumPublicUrl(datos.publicSlug),
  ];
  return lineas.join("\n");
}

/**
 * Menciones en orden de importancia. El motor decide cuáles entran como colaboradores y
 * cuáles caen al copy: el límite de Instagram no está documentado de forma estable.
 */
export function buildAlbumMentions(datos: AlbumSocialData): MentionCandidate[] {
  const candidatos: MentionCandidate[] = [];
  if (datos.photographerHandle) {
    candidatos.push({ handle: datos.photographerHandle, priority: 1, role: "PHOTOGRAPHER" });
  }
  if (datos.organizerHandle) {
    candidatos.push({ handle: datos.organizerHandle, priority: 2, role: "ORGANIZER" });
  }
  datos.sponsorHandles.forEach((h, i) => {
    candidatos.push({ handle: h, priority: 3 + i * 0.1, role: "SPONSOR" });
  });
  candidatos.push({ handle: PLATFORM_HANDLE, priority: 100, role: "PLATFORM" });
  return candidatos;
}

export function buildAlbumPieceSpecs(datos: AlbumSocialData): SocialPieceSpec[] {
  const values = {
    nombreAlbum: datos.albumName,
    fecha: datos.eventDate,
    arrobaFotografo: datos.photographerHandle ? `@${datos.photographerHandle}` : "",
    urlAlbum: albumPublicUrl(datos.publicSlug),
    foto1: datos.photoUrls[0] ?? "",
    foto2: datos.photoUrls[1] ?? "",
    foto3: datos.photoUrls[2] ?? "",
    foto4: datos.photoUrls[3] ?? "",
  };

  // El Designer no sabe de red: se le entregan los bytes de cada foto. Este es el único
  // lugar de todo el armado que hace `fetch`; a partir de acá, solo bytes.
  const resources = {
    async read(ref: string): Promise<Uint8Array | null> {
      if (!/^https?:\/\//.test(ref)) return null;
      try {
        const r = await fetch(ref);
        if (!r.ok) return null;
        return new Uint8Array(await r.arrayBuffer());
      } catch {
        return null;
      }
    },
  };

  return [
    {
      pieceId: "clf-album-carousel",
      format: "CAROUSEL",
      document: albumCarouselDocument(datos.photoUrls.length),
      contract: ALBUM_VARIABLE_CONTRACT,
      values,
      resources,
      dpi: SCREEN_PNG_DPI,
    },
    {
      pieceId: "clf-album-story",
      format: "STORY",
      document: ALBUM_STORY_DOCUMENT,
      contract: ALBUM_VARIABLE_CONTRACT,
      values,
      resources,
      dpi: SCREEN_PNG_DPI,
    },
  ];
}
