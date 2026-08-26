/**
 * CMS ETAPA 03/04 — scope multiplataforma del Blog.
 * CLF solo lee/escribe filas con platform = "compramelafoto".
 * El valor se asigna siempre en servidor; nunca se acepta desde el cliente.
 */
import {
  CONTENT_PLATFORMS,
  isContentPlatform,
  type ContentPlatform,
} from "@repo/content";

export const CLF_CONTENT_PLATFORM = "compramelafoto" as const;

export { CONTENT_PLATFORMS, isContentPlatform, type ContentPlatform };

/** Alias semántico para imports CLF. */
export type ClfContentPlatform = typeof CLF_CONTENT_PLATFORM;

export const clfPlatformWhere = { platform: CLF_CONTENT_PLATFORM } as const;
