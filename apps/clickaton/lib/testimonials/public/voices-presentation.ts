/**
 * Cómo se presenta un testimonio en el sitio público.
 */
import type { ClickatonTestimonialAuthorRole } from "../domain/types";

/**
 * Con menos de tres la sección no se dibuja. Dos testimonios sueltos en una
 * home se leen como "nadie opinó", que es peor que no tener la sección.
 */
export const MIN_TESTIMONIALS_TO_SHOW = 3;

export function shouldRenderVoices(publishedCount: number): boolean {
  return publishedCount >= MIN_TESTIMONIALS_TO_SHOW;
}

const ROLE_LABELS: Record<ClickatonTestimonialAuthorRole, string> = {
  PARTICIPANT: "Participante",
  JUROR: "Jurado",
  VENUE: "Sede",
};

export function authorRoleLabel(role: ClickatonTestimonialAuthorRole): string {
  return ROLE_LABELS[role];
}

/**
 * La foto se pide por el id del testimonio: la llave es la publicación, no la
 * clave del archivo, que sigue siendo privada.
 */
export function testimonialPhotoPath(testimonialId: string): string {
  return `/api/public/testimonios/${testimonialId}/foto`;
}

export function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return (first.charAt(0) + (last?.charAt(0) ?? "")).toUpperCase();
}
