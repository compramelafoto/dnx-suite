/**
 * Correo público de MercadoFotoRaw (`CONTACTO_EMAIL`). Si no está configurado, las pantallas y
 * correos que invitan a escribirnos omiten la invitación en vez de enlazar a ningún lado.
 */

// Estricto a propósito: nada de `?`, `&` ni espacios que agreguen destinatarios al mailto.
const CORREO_VALIDO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** El correo configurado, o `null` si falta o no parece un correo. */
export function contactoEmail(): string | null {
  const v = process.env.CONTACTO_EMAIL?.trim();
  return v && CORREO_VALIDO.test(v) ? v : null;
}

/** Enlace `mailto:` con el asunto, o `null` si no hay correo de contacto. */
export function contactoMailto(asunto: string): string | null {
  const email = contactoEmail();
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(asunto)}`;
}
