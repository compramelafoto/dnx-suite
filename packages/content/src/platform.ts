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

export function platformWhere(platform: ContentPlatform): { platform: ContentPlatform } {
  return { platform: assertContentPlatform(platform) };
}
