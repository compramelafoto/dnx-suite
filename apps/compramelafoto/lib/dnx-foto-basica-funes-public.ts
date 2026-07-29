/**
 * Constantes y helpers seguros para Client Components del curso Funes.
 * No importar Prisma ni módulos server-only desde aquí.
 */

export const DNX_FOTO_BASICA_FUNES_SLUG = "fotografia-basica-funes" as const;

/** Clave interna para cupos e inscripciones (no cambiar si hay filas en producción). */
export const DNX_FOTO_BASICA_FUNES_COURSE_KEY = "dnx-foto-basica-funes-2025-06-06" as const;

export const DNX_FOTO_BASICA_FUNES_MAX_SEATS = 12;
export const DNX_FOTO_BASICA_FUNES_PRICE_ARS = 150_000;

/** Tiempo que una inscripción PENDING reserva cupo para evitar sobrecarga simultánea */
export const DNX_FOTO_BASICA_PENDING_HOLD_MS = 45 * 60 * 1000;

export function isDnxFotoBasicaFunesSlug(slug: string): boolean {
  return slug.trim() === DNX_FOTO_BASICA_FUNES_SLUG;
}

export function normalizeDnxEnrollmentEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** WhatsApp del organizador (curso Funes). Formato internacional sin + para wa.me */
export const DNX_FUNES_COURSE_WHATSAPP_PHONE_DEFAULT = "5493413748324";

const DNX_FUNES_LANDING_WHATSAPP_PREFILL =
  "Hola Daniel, te escribo desde la landing del Curso de Fotografía Básica en Funes (ComprameLaFoto). Quería consultarte:";

/**
 * Enlace wa.me con texto precargado (origen landing). Si definís `NEXT_PUBLIC_DNX_FUNES_COURSE_WHATSAPP_URL`,
 * se usa esa URL tal cual (reemplazo total).
 */
export function getDnxFotoBasicaFunesWhatsAppUrl(): string {
  const direct = process.env.NEXT_PUBLIC_DNX_FUNES_COURSE_WHATSAPP_URL?.trim();
  if (direct) return direct;
  const phoneDigits = (process.env.NEXT_PUBLIC_DNX_FUNES_COURSE_WHATSAPP_PHONE ?? "").replace(/\D/g, "");
  const phone =
    phoneDigits.length >= 10 ? phoneDigits : DNX_FUNES_COURSE_WHATSAPP_PHONE_DEFAULT;
  const text = encodeURIComponent(DNX_FUNES_LANDING_WHATSAPP_PREFILL);
  return `https://wa.me/${phone}?text=${text}`;
}
