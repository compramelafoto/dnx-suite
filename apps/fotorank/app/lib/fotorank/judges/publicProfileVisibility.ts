/**
 * Qué del perfil de un jurado puede ver cualquiera.
 *
 * Se recorta acá y no en la pantalla: un dato que no se puede mostrar no sale
 * de la capa de datos. El directorio ya respetaba estos interruptores; la
 * página pública individual los ignoraba.
 */
export type PerfilCompleto = {
  website: string | null;
  instagram: string | null;
  otherLinksJson: unknown;
  city: string | null;
  country: string | null;
  /** Nunca sale al público. Está en el tipo para que quede dicho. */
  phone: string | null;
  showWebsitePublicly: boolean;
  showInstagramPublicly: boolean;
  showLocationPublicly: boolean;
};

export type PerfilVisible = {
  website: string | null;
  instagram: string | null;
  otherLinksJson: unknown;
  city: string | null;
  country: string | null;
};

export function recortarPerfilParaElPublico(p: PerfilCompleto): PerfilVisible {
  return {
    website: p.showWebsitePublicly ? p.website : null,
    instagram: p.showInstagramPublicly ? p.instagram : null,
    // Los otros links no tienen interruptor propio: el jurado los cargó uno por
    // uno justamente para que se vean.
    otherLinksJson: p.otherLinksJson,
    city: p.showLocationPublicly ? p.city : null,
    country: p.showLocationPublicly ? p.country : null,
  };
}
