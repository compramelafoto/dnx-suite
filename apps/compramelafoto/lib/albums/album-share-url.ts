export function buildAlbumQrImageUrl(targetUrl: string, size = 320): string {
  const encoded = encodeURIComponent(targetUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}

export type AlbumShareLinkItem = {
  id: string;
  label: string;
  description?: string;
  url: string;
  path: string;
};

export type AlbumShareContextInput = {
  origin: string;
  publicSlug: string;
  eventShareSlug?: string | null;
  photographerHandler?: string | null;
  albumId: number;
  mode?: "SIMPLE" | "EVENT" | "SCHOOL" | "COLLABORATIVE";
};

/** URL principal recomendada para compartir (evento galería si existe, si no álbum). */
export function resolveAlbumPrimaryShareUrl(input: AlbumShareContextInput): string {
  const eventSlug =
    typeof input.eventShareSlug === "string" ? input.eventShareSlug.trim() : "";
  if (eventSlug) return `${input.origin}/g/${eventSlug}`;
  if (input.publicSlug) return `${input.origin}/a/${input.publicSlug}`;
  return "";
}

export function buildAlbumShareLinks(
  input: AlbumShareContextInput,
  options?: { includePhotographer?: boolean; includeBuy?: boolean }
): AlbumShareLinkItem[] {
  const { origin, publicSlug, eventShareSlug, photographerHandler, albumId, mode } = input;
  const links: AlbumShareLinkItem[] = [];

  const eventSlug =
    typeof eventShareSlug === "string" ? eventShareSlug.trim() : "";

  if (publicSlug) {
    links.push({
      id: "album",
      label: "Álbum para clientes",
      description: "Galería de compra del álbum",
      path: `/a/${publicSlug}`,
      url: `${origin}/a/${publicSlug}`,
    });
  }

  if (eventSlug) {
    links.push({
      id: "event-gallery",
      label: "Galería del evento",
      description: "Vista agregada del evento",
      path: `/g/${eventSlug}`,
      url: `${origin}/g/${eventSlug}`,
    });
  }

  if (mode === "COLLABORATIVE" && eventSlug) {
    links.push({
      id: "event-collab",
      label: "Evento colaborativo",
      description: "Vista pública del evento",
      path: `/e/${eventSlug}`,
      url: `${origin}/e/${eventSlug}`,
    });
  }

  if (options?.includePhotographer && photographerHandler) {
    links.push({
      id: "photographer",
      label: "Landing del fotógrafo",
      description: "Tu página pública",
      path: `/${photographerHandler}`,
      url: `${origin}/${photographerHandler}`,
    });
  }

  if (options?.includeBuy && albumId) {
    links.push({
      id: "buy",
      label: "Compra directa",
      description: "Link directo al flujo de compra",
      path: `/a/${albumId}/comprar`,
      url: `${origin}/a/${albumId}/comprar`,
    });
  }

  return links;
}
