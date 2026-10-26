import { sanitizeContentHtml } from "@repo/content";
import type { WebsiteBlock } from "./blocks";

/**
 * Saneo del HTML de los bloques de texto con formato. Vive aparte de `blocks.ts` porque
 * `@repo/content` es pesado (sanitize-html, extensiones de TipTap…) y `blocks.ts` llega al
 * bundle del navegador de cada sitio público. Sólo lo usan la acción de guardar y la vista del
 * bloque, que se dibuja en el servidor.
 */

/** Devuelve la config con el HTML limpio de scripts, atributos de evento e iframes ajenos.
 * El sanitizador deja un `<iframe></iframe>` vacío cuando descarta el `src` de uno no permitido;
 * se quita también para que no quede un marco en blanco en la página. */
export function sanitizeRichTextConfig<T extends { html: string }>(config: T): T {
  const html = sanitizeContentHtml(config.html).replace(/<iframe(?![^>]*\ssrc=)[^>]*><\/iframe>/gi, "");
  return { ...config, html };
}

/** Sanea lo que haga falta de los bloques antes de persistirlos (hoy, el HTML de RICH_TEXT).
 * No muta la entrada. Lo usa la acción de guardar, así un cliente tramposo no puede colar HTML. */
export function sanitizeBlocksForSave(blocks: WebsiteBlock[]): WebsiteBlock[] {
  return blocks.map((b) => (b.type === "RICH_TEXT" ? { ...b, config: sanitizeRichTextConfig(b.config) } : b));
}
