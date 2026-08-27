/**
 * Descarga de imágenes remotas para embeberlas como data URL antes de renderizar.
 *
 * Chromium podría bajar la imagen por su cuenta, pero embeberla en el servidor
 * es más confiable: funciona igual con el worker remoto (que no tiene por qué
 * alcanzar el origen de la app), no depende de sesiones ni cookies, y falla de
 * forma explícita en vez de dejar un hueco silencioso en la placa.
 */
import { TEMPLATE_V2_PREVIEW_LIMITS } from "./render-limits";
import { assertPreviewAssetUrlShape } from "./asset-resolver";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const EXTENSION_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export type FetchImageAsDataUrlResult =
  | { ok: true; dataUrl: string; mimeType: string; byteSize: number }
  | { ok: false; reason: string };

export type FetchImageAsDataUrlOptions = {
  /** Base absoluta para resolver rutas como `/api/media/...`. */
  baseUrl?: string | null;
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
};

function mimeFromExtension(url: string): string | null {
  const path = url.split("?")[0] ?? "";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext] ?? null;
}

/**
 * Resuelve `raw` a una URL absoluta. Devuelve null si es relativa y no hay base:
 * una ruta relativa no significa nada para el renderer.
 */
export function toAbsoluteAssetUrl(
  raw: string | null | undefined,
  baseUrl?: string | null
): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (/^data:/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) {
    const base = baseUrl?.trim().replace(/\/$/, "") ?? "";
    if (!base) return null;
    return `${base}${value}`;
  }
  return null;
}

export async function fetchImageAsDataUrl(
  raw: string | null | undefined,
  options: FetchImageAsDataUrlOptions = {}
): Promise<FetchImageAsDataUrlResult> {
  const absolute = toAbsoluteAssetUrl(raw, options.baseUrl);
  if (!absolute) {
    return {
      ok: false,
      reason: raw?.trim()
        ? "URL relativa sin base absoluta configurada"
        : "sin URL de imagen",
    };
  }

  if (/^data:/i.test(absolute)) {
    try {
      assertPreviewAssetUrlShape(absolute);
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "data URL inválida" };
    }
    const mimeType = absolute.slice(5, absolute.indexOf(";"));
    const b64 = absolute.split(",")[1] ?? "";
    return {
      ok: true,
      dataUrl: absolute,
      mimeType,
      byteSize: Math.floor((b64.length * 3) / 4),
    };
  }

  try {
    // Reusa el guard de SSRF: bloquea hosts privados, loopback y metadata.
    assertPreviewAssetUrlShape(absolute);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "URL no permitida" };
  }

  const maxBytes = options.maxBytes ?? TEMPLATE_V2_PREVIEW_LIMITS.maxRemoteAssetBytes;
  const timeoutMs = options.timeoutMs ?? TEMPLATE_V2_PREVIEW_LIMITS.remoteFetchTimeoutMs;
  const fetchImpl = options.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(absolute, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/png,image/jpeg,image/webp,image/*" },
    });

    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status} al descargar la imagen` };
    }

    const declared = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      ?.trim()
      .toLowerCase();
    const mimeType =
      declared && ALLOWED_MIME.has(declared)
        ? declared
        : mimeFromExtension(absolute);

    if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
      return {
        ok: false,
        reason: `formato no admitido (${declared || "desconocido"}); usar PNG, JPG o WEBP`,
      };
    }

    const declaredLength = Number(response.headers.get("content-length") ?? "");
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return { ok: false, reason: `imagen demasiado pesada (${declaredLength} bytes)` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      return { ok: false, reason: "la imagen llegó vacía" };
    }
    if (buffer.length > maxBytes) {
      return { ok: false, reason: `imagen demasiado pesada (${buffer.length} bytes)` };
    }

    return {
      ok: true,
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
      mimeType,
      byteSize: buffer.length,
    };
  } catch (err) {
    const aborted =
      err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message));
    return {
      ok: false,
      reason: aborted
        ? `timeout de ${timeoutMs}ms al descargar la imagen`
        : err instanceof Error
          ? err.message
          : "error al descargar la imagen",
    };
  } finally {
    clearTimeout(timer);
  }
}
