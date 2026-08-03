/**
 * CMS ETAPA 03 — scope multiplataforma del Blog.
 * CLF solo lee/escribe filas con platform = "compramelafoto".
 * El valor se asigna siempre en servidor; nunca se acepta desde el cliente.
 */

export const CLF_CONTENT_PLATFORM = "compramelafoto" as const;

export const CONTENT_PLATFORMS = [
  "compramelafoto",
  "clickaton",
  "fotorank",
  "fotoffice",
] as const;

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

/** Alias semántico para imports CLF. */
export type ClfContentPlatform = typeof CLF_CONTENT_PLATFORM;

export const clfPlatformWhere = { platform: CLF_CONTENT_PLATFORM } as const;

export function isContentPlatform(value: string): value is ContentPlatform {
  return (CONTENT_PLATFORMS as readonly string[]).includes(value);
}
