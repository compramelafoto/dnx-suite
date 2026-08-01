import { TEMPLATE_V2_PREVIEW_LIMITS } from "./render-limits";
import {
  previewAssetFailed,
  previewLimitExceeded,
} from "./render-errors";

const ALLOWED_DATA_MIME = /^data:image\/(png|jpeg|jpg|webp);base64,/i;
const BLOCKED_PROTOCOLS = /^(javascript|vbscript|file|ftp|blob):/i;

export type ResolvedPreviewAsset = {
  src: string;
  kind: "empty" | "data" | "https" | "relative" | "placeholder";
  warning?: string;
};

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "metadata.google.internal" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }
  // IPv4 privados
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

export function assertPreviewAssetUrlShape(url: string): void {
  const t = url.trim();
  if (!t) return;
  if (BLOCKED_PROTOCOLS.test(t)) {
    throw previewAssetFailed("Protocolo de asset no permitido");
  }
  if (/^data:/i.test(t)) {
    if (!ALLOWED_DATA_MIME.test(t)) {
      throw previewAssetFailed("Data URL de imagen no permitida");
    }
    const b64 = t.split(",")[1] ?? "";
    const approxBytes = Math.floor((b64.length * 3) / 4);
    if (approxBytes > TEMPLATE_V2_PREVIEW_LIMITS.maxDataUrlBytes) {
      throw previewLimitExceeded("Data URL excede el tamaño máximo");
    }
    return;
  }
  if (t.startsWith("/") || t.startsWith("./") || t.startsWith("../")) {
    // relative — se resuelve contra APP_URL si hace falta; no fetch cruzado
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(t);
  } catch {
    throw previewAssetFailed("URL de asset inválida");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw previewAssetFailed("Solo se permiten http(s) para assets remotos");
  }
  // Preferir https; http solo en desarrollo local de assets públicos
  if (isPrivateHostname(parsed.hostname)) {
    throw previewAssetFailed("Host privado / local bloqueado (SSRF)");
  }
}

/**
 * Resuelve src de imagen para el HTML de preview.
 * V1: no descarga remota en el server (evita SSRF/IO); valida y deja URL segura
 * o convierte data URL permitida. Imágenes remotas se cargan en Chromium con
 * CSP restrictiva; hosts privados ya fueron bloqueados.
 */
export function resolvePreviewAssetSrc(
  raw: unknown,
  options?: { optional?: boolean; placeholder?: string }
): ResolvedPreviewAsset {
  const src = typeof raw === "string" ? raw.trim() : "";
  if (!src) {
    if (options?.optional) {
      return {
        src: options.placeholder ?? "",
        kind: "placeholder",
        warning: "imagen_opcional_ausente",
      };
    }
    return { src: "", kind: "empty" };
  }

  try {
    assertPreviewAssetUrlShape(src);
  } catch (err) {
    // Protocolos / hosts peligrosos NUNCA se suavizan (SSRF / XSS).
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    if (
      code === "TEMPLATE_PREVIEW_ASSET_FAILED" ||
      code === "TEMPLATE_PREVIEW_LIMIT_EXCEEDED"
    ) {
      throw err;
    }
    if (options?.optional) {
      return {
        src: options.placeholder ?? "",
        kind: "placeholder",
        warning: err instanceof Error ? err.message : "asset_invalid",
      };
    }
    throw err;
  }

  if (/^data:/i.test(src)) {
    return { src, kind: "data" };
  }
  if (src.startsWith("/")) {
    return { src, kind: "relative" };
  }
  return { src, kind: "https" };
}

export function countImageSources(blocks: Array<{ type: string; config?: Record<string, unknown> }>): number {
  let n = 0;
  for (const b of blocks) {
    if (b.type === "IMAGE" || b.type === "PHOTO" || b.type === "BACKGROUND") {
      const cfg = b.config ?? {};
      const src = typeof cfg.src === "string" ? cfg.src : "";
      const sourceSrc =
        cfg.source && typeof cfg.source === "object"
          ? String((cfg.source as { src?: string; url?: string }).src ?? (cfg.source as { url?: string }).url ?? "")
          : "";
      if (src || sourceSrc) n += 1;
    }
  }
  return n;
}
