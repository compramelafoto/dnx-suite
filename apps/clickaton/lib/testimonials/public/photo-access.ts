/**
 * La única compuerta de la foto de un testimonio.
 *
 * Las fotos de perfil de los participantes viven en un namespace privado que
 * `/api/media` no sirve. Acá la llave es la publicación: despublicar un
 * testimonio corta el acceso a su foto en el mismo acto.
 */

export type TestimonialPhotoGate = {
  status: "PENDING" | "PUBLISHED" | "REJECTED";
  publicationConsent: boolean;
  authorPhotoAssetId: string | null;
};

export function canServeTestimonialPhoto(
  testimonial: TestimonialPhotoGate | null,
): boolean {
  if (!testimonial) return false;
  if (testimonial.status !== "PUBLISHED") return false;
  if (!testimonial.publicationConsent) return false;
  return Boolean(testimonial.authorPhotoAssetId);
}
