/**
 * CMS ETAPA 06 — scope multiplataforma del Blog en Clickatón.
 * Clickatón solo lee/escribe filas con platform = "clickaton".
 * El valor se asigna siempre en servidor; nunca se acepta desde el cliente.
 */
import {
  CONTENT_PLATFORMS,
  isContentPlatform,
  type ContentPlatform,
} from "@repo/content";

export const CLICKATON_CONTENT_PLATFORM = "clickaton" as const;

export { CONTENT_PLATFORMS, isContentPlatform, type ContentPlatform };

/** Alias semántico para imports Clickatón. */
export type ClickatonContentPlatform = typeof CLICKATON_CONTENT_PLATFORM;

export const clickatonPlatformWhere = { platform: CLICKATON_CONTENT_PLATFORM } as const;

/**
 * Quita cualquier `platform` que venga en el payload del cliente.
 * El servidor es la única fuente de verdad del scope.
 */
export function stripClientPlatform<T extends Record<string, unknown>>(
  body: T,
): Omit<T, "platform"> {
  if (!body || typeof body !== "object") return body;
  const rest: Record<string, unknown> = { ...body };
  delete rest.platform;
  return rest as Omit<T, "platform">;
}
