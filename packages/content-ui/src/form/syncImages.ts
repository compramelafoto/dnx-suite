export type ContentImageFields = {
  heroImageUrl?: string | null;
  ogImageUrl?: string | null;
};

/**
 * Al guardar: la imagen OG coincide con la miniatura (hero).
 * Puro — sin I/O ni branding.
 */
export function syncContentPostImageFields(input: ContentImageFields): {
  heroImageUrl: string | null;
  ogImageUrl: string | null;
} {
  const hero = input.heroImageUrl?.trim() || null;
  const og = input.ogImageUrl?.trim() || null;
  const thumbnail = hero || og;
  return {
    heroImageUrl: hero,
    ogImageUrl: thumbnail,
  };
}
