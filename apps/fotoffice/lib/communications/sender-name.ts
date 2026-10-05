/**
 * Remitente por institución. Módulo puro.
 *
 * La casilla es una sola —la verificada en Resend, `FOTOFFICE_NOTIFICATIONS_FROM`—, pero el NOMBRE
 * que ve el socio en su bandeja es el de su institución: «SFPR», no «FOTOFFICE». Las respuestas van
 * a la casilla de contacto de la institución (`reply_to`), no a la nuestra.
 */

export type WorkspaceSender = {
  /** Nombre visible. null = se respeta el del entorno. */
  name: string | null;
  /** A dónde van las respuestas. null = sin `reply_to`. */
  replyTo: string | null;
};

const SIMPLE_EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;.]+(?:\.[^\s@<>",;.]+)+$/;

/** La casilla de un remitente `Nombre <casilla@dominio>` o pelado. null si no se reconoce. */
export function extractAddress(from: string): string | null {
  const trimmed = from.trim();
  const angle = trimmed.match(/<([^<>]+)>\s*$/);
  const candidate = (angle ? angle[1] : trimmed).trim();
  return SIMPLE_EMAIL_RE.test(candidate) ? candidate : null;
}

/**
 * Nombre visible apto para una cabecera: sin comillas, ángulos ni saltos de línea (que permitirían
 * inyectar cabeceras), en una línea y acotado.
 */
export function sanitizeDisplayName(name: string | null | undefined): string | null {
  const clean = (name ?? "").replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || null;
}

/** Arma el `from` final. Si no se puede reemplazar el nombre con seguridad, devuelve el original. */
export function buildFromHeader(envFrom: string, name: string | null | undefined): string {
  const display = sanitizeDisplayName(name);
  const address = extractAddress(envFrom);
  if (!display || !address) return envFrom;
  return `"${display}" <${address}>`;
}

export function sanitizeReplyTo(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return SIMPLE_EMAIL_RE.test(v) ? v : null;
}
