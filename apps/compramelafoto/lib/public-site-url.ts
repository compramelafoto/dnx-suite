const DEFAULT_ORIGIN = "https://compramelafoto.com";

/**
 * Origen público canónico (OG, emails, copiar enlace).
 * No usa VERCEL_URL: en deploys de Vercel apunta a *.vercel.app con protección SSO.
 */
export function getPublicSiteOrigin(): string {
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/\/$/, "");
      }
    }
  }
  return DEFAULT_ORIGIN;
}

/** Perfil público del fotógrafo — usar en <Link> de la app. */
export function publicPhotographerProfilePath(handler: string): string {
  return `/${handler.trim().replace(/^\/+/, "")}`;
}

export function publicEventGalleryPath(shareSlug: string): string {
  return `/g/${shareSlug}`;
}

export function publicEventJoinPath(shareSlug: string): string {
  return `/e/${shareSlug}`;
}

export function publicAlbumPath(publicSlug: string): string {
  return `/a/${publicSlug}`;
}
