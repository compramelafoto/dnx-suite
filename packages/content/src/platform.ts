import { z } from "zod";
import { ContentError } from "./errors";

/**
 * Lista local alineada con ids lowercase de apps DNX (`DNX_APPLICATIONS` en `@repo/auth`).
 * Se mantiene aquí para evitar dependencia circular con `@repo/auth`.
 * Info Spot no figura: no es destino de publicación del CMS.
 */
export const CONTENT_PLATFORMS = [
  "compramelafoto",
  "clickaton",
  "fotorank",
  "fotoffice",
] as const;

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export const contentPlatformSchema = z.enum(CONTENT_PLATFORMS);

export function isContentPlatform(value: string): value is ContentPlatform {
  return (CONTENT_PLATFORMS as readonly string[]).includes(value);
}

export function assertContentPlatform(value: unknown): ContentPlatform {
  if (value == null || value === "") {
    throw new ContentError(
      "CONTENT_PLATFORM_REQUIRED",
      "platform is required for content operations"
    );
  }
  if (typeof value !== "string" || !isContentPlatform(value)) {
    throw new ContentError(
      "CONTENT_PLATFORM_REQUIRED",
      `Invalid content platform: ${String(value)}`
    );
  }
  return value;
}

/**
 * Plataformas donde cada institución tiene su propio blog. En las demás hay uno solo por
 * plataforma y `workspaceKey` es siempre "".
 */
export const PER_WORKSPACE_CONTENT_PLATFORMS: readonly ContentPlatform[] = ["fotoffice"];

export type ContentScope = { platform: ContentPlatform; workspaceKey: string };

/**
 * El alcance de una operación: plataforma + institución.
 *
 * Falla en los dos sentidos a propósito. En FOTOFFICE sin institución, una consulta leería los
 * blogs de todas a la vez; en CompraMeLaFoto o Clickatón con institución, no encontraría nada
 * de lo que ya tienen. Las dos son errores de quien llama, no algo que convenga adivinar.
 */
export function resolveContentScope(platform: unknown, workspaceKey?: string | null): ContentScope {
  const p = assertContentPlatform(platform);
  const key = (workspaceKey ?? "").trim();
  const porInstitucion = PER_WORKSPACE_CONTENT_PLATFORMS.includes(p);
  if (porInstitucion && !key) {
    throw new ContentError(
      "CONTENT_WORKSPACE_REQUIRED",
      `workspaceKey is required for content operations on ${p}`
    );
  }
  if (!porInstitucion && key) {
    throw new ContentError(
      "CONTENT_WORKSPACE_NOT_ALLOWED",
      `workspaceKey is not allowed for content operations on ${p}`
    );
  }
  return { platform: p, workspaceKey: key };
}

/** El filtro de alcance para Prisma. Sin `workspaceKey`, el blog de la plataforma entera. */
export function platformWhere(
  platform: ContentPlatform,
  workspaceKey?: string | null
): ContentScope {
  return resolveContentScope(platform, workspaceKey);
}
