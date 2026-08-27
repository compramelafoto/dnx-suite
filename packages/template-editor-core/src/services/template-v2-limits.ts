import { TemplateV2DomainError } from "./template-v2-errors";

/** Límites de seguridad para payloads Template V2 (P0-03). */
export const TEMPLATE_V2_LIMITS = {
  maxJsonBytes: 2_000_000,
  maxBlocks: 400,
  maxBindings: 400,
  maxTextLength: 20_000,
  maxNameLength: 240,
  maxMetaKeys: 80,
  maxMetaStringLength: 4_000,
  maxCanvasWidth: 20_000,
  maxCanvasHeight: 20_000,
  minCanvasWidth: 1,
  minCanvasHeight: 1,
  maxImageUploadBytes: 8 * 1024 * 1024,
} as const;

const DANGEROUS_URL_PROTOCOLS = /^(javascript|vbscript):/i;

export function assertPayloadSize(byteLength: number): void {
  if (byteLength > TEMPLATE_V2_LIMITS.maxJsonBytes) {
    throw new TemplateV2DomainError(
      "TEMPLATE_PAYLOAD_TOO_LARGE",
      `Payload supera el máximo de ${TEMPLATE_V2_LIMITS.maxJsonBytes} bytes`,
      413
    );
  }
}

export function isDangerousUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (DANGEROUS_URL_PROTOCOLS.test(t)) return true;
  if (/^data:/i.test(t) && !/^data:image\/(png|jpeg|jpg|webp|gif);/i.test(t)) {
    return true;
  }
  return false;
}

export function assertSafeAssetUrl(url: string | undefined | null): void {
  if (url == null || url === "") return;
  if (typeof url !== "string" || isDangerousUrl(url)) {
    throw new TemplateV2DomainError(
      "TEMPLATE_ASSET_INVALID",
      "URL de asset no permitida",
      422
    );
  }
}

export function sanitizeTemplateName(name: unknown, fallback = "Nueva plantilla"): string {
  const raw = typeof name === "string" ? name.trim() : "";
  const base = raw || fallback;
  return base.slice(0, TEMPLATE_V2_LIMITS.maxNameLength);
}
