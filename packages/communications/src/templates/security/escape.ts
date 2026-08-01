/**
 * Escape HTML para datos dinámicos en emails.
 * No interpreta markup del payload.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapa para atributos HTML (mismo set; mantiene comillas seguras). */
export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

/** Convierte HTML escapado / texto a líneas de texto plano seguras. */
export function toPlainText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
