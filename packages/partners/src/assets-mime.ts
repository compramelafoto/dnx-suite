import {
  PARTNER_ALLOWED_IMAGE_MIMES,
  PARTNER_ALLOWED_LOGO_MIMES,
  PARTNER_ALLOWED_PDF_MIMES,
  PARTNER_ALLOWED_VIDEO_MIMES,
  PARTNER_SVG_ENABLED,
  type PartnerAssetLimits,
  DEFAULT_PARTNER_ASSET_LIMITS,
  resolvePartnerAssetLimits,
} from "./assets-limits";
import { PartnersDomainError } from "./types";

export type PartnerDetectedFileKind = "image" | "pdf" | "video" | "svg" | "unknown";

export type PartnerMimeDetection = {
  mime: string;
  extension: string;
  kind: PartnerDetectedFileKind;
  valid: boolean;
};

/** Magic bytes — no confiar en extensión ni Content-Type del cliente. */
export function detectPartnerFileMime(
  buffer: Uint8Array,
  declaredMime?: string,
): PartnerMimeDetection {
  const b = buffer;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg", kind: "image", valid: true };
  }
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  ) {
    return { mime: "image/png", extension: "png", kind: "image", valid: true };
  }
  if (
    b.length >= 12 &&
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp", kind: "image", valid: true };
  }
  if (b.length >= 4 && String.fromCharCode(...b.slice(0, 4)) === "%PDF") {
    return { mime: "application/pdf", extension: "pdf", kind: "pdf", valid: true };
  }
  // MP4 / ISO BMFF
  if (b.length >= 12 && String.fromCharCode(...b.slice(4, 8)) === "ftyp") {
    return { mime: "video/mp4", extension: "mp4", kind: "video", valid: true };
  }
  // WebM (EBML)
  if (
    b.length >= 4 &&
    b[0] === 0x1a &&
    b[1] === 0x45 &&
    b[2] === 0xdf &&
    b[3] === 0xa3
  ) {
    return { mime: "video/webm", extension: "webm", kind: "video", valid: true };
  }
  // SVG text sniff
  const head = String.fromCharCode(...b.slice(0, Math.min(256, b.length))).toLowerCase();
  if (head.includes("<svg") || (head.includes("<?xml") && head.includes("svg"))) {
    return {
      mime: "image/svg+xml",
      extension: "svg",
      kind: "svg",
      valid: PARTNER_SVG_ENABLED,
    };
  }
  return {
    mime: declaredMime || "application/octet-stream",
    extension: "bin",
    kind: "unknown",
    valid: false,
  };
}

export function assertSafeStorageFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "file";
  if (base.includes("..") || base.includes("\0")) {
    throw new PartnersDomainError("VALIDATION", "Nombre de archivo inválido.", {
      originalFilename: "Path traversal no permitido.",
    });
  }
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  if (!safe || safe === "." || safe === "..") {
    throw new PartnersDomainError("VALIDATION", "Nombre de archivo inválido.", {
      originalFilename: "Nombre vacío o inválido.",
    });
  }
  return safe;
}

export function assertPartnerUploadAllowed(input: {
  buffer: Uint8Array;
  declaredMime?: string;
  declaredExtension?: string;
  limits?: PartnerAssetLimits;
}): PartnerMimeDetection {
  const limits = input.limits ?? DEFAULT_PARTNER_ASSET_LIMITS;
  const detected = detectPartnerFileMime(input.buffer, input.declaredMime);
  if (!detected.valid) {
    if (detected.kind === "svg" && !PARTNER_SVG_ENABLED) {
      throw new PartnersDomainError(
        "VALIDATION",
        "SVG no permitido sin sanitización segura.",
        { mimeType: "SVG rechazado." },
      );
    }
    throw new PartnersDomainError("VALIDATION", "Tipo de archivo no permitido.", {
      mimeType: `Detectado: ${detected.mime}`,
    });
  }

  const declared = (input.declaredMime ?? "").toLowerCase().replace("image/jpg", "image/jpeg");
  const real = detected.mime.toLowerCase().replace("image/jpg", "image/jpeg");
  if (declared && declared !== "application/octet-stream" && declared !== real) {
    // permitir image/jpg vs image/jpeg
    const norm = (m: string) => (m === "image/jpg" ? "image/jpeg" : m);
    if (norm(declared) !== norm(real)) {
      throw new PartnersDomainError("VALIDATION", "MIME incoherente con el contenido.", {
        mimeType: `Declarado ${declared}, real ${real}`,
      });
    }
  }

  if (input.declaredExtension) {
    const ext = input.declaredExtension.replace(/^\./, "").toLowerCase();
    const allowedForMime: Record<string, string[]> = {
      "image/jpeg": ["jpg", "jpeg"],
      "image/png": ["png"],
      "image/webp": ["webp"],
      "application/pdf": ["pdf"],
      "video/mp4": ["mp4"],
      "video/webm": ["webm"],
    };
    const ok = allowedForMime[real]?.includes(ext);
    if (ok === false || (allowedForMime[real] && !ok)) {
      throw new PartnersDomainError("VALIDATION", "Extensión incoherente con el contenido.", {
        fileExtension: `Extensión .${ext} no coincide con ${real}`,
      });
    }
  }

  const size = input.buffer.byteLength;
  if (detected.kind === "image" && size > limits.imageMaxBytes) {
    throw new PartnersDomainError("VALIDATION", "Imagen demasiado grande.", {
      fileSize: `Máximo ${limits.imageMaxBytes} bytes.`,
    });
  }
  if (detected.kind === "pdf" && size > limits.pdfMaxBytes) {
    throw new PartnersDomainError("VALIDATION", "PDF demasiado grande.", {
      fileSize: `Máximo ${limits.pdfMaxBytes} bytes.`,
    });
  }
  if (detected.kind === "video" && size > limits.videoMaxBytes) {
    throw new PartnersDomainError("VALIDATION", "Video demasiado grande.", {
      fileSize: `Máximo ${limits.videoMaxBytes} bytes.`,
    });
  }
  if (detected.kind === "svg" && size > limits.svgMaxBytes) {
    throw new PartnersDomainError("VALIDATION", "SVG demasiado grande.", {
      fileSize: `Máximo ${limits.svgMaxBytes} bytes.`,
    });
  }

  const allowed = [
    ...PARTNER_ALLOWED_IMAGE_MIMES,
    ...PARTNER_ALLOWED_PDF_MIMES,
    ...PARTNER_ALLOWED_VIDEO_MIMES,
  ].map((m) => m.replace("image/jpg", "image/jpeg"));
  if (!allowed.includes(real === "image/jpg" ? "image/jpeg" : real)) {
    throw new PartnersDomainError("VALIDATION", "MIME no permitido.", {
      mimeType: real,
    });
  }

  return detected;
}

/**
 * Validación específica para logos de identidad.
 * Solo PNG/WEBP (nuevos uploads). JPG/JPEG/SVG rechazados.
 * No afecta materiales no-logo ni assets legacy.
 */
export function assertPartnerLogoUploadAllowed(input: {
  buffer: Uint8Array;
  declaredMime?: string;
  declaredExtension?: string;
  limits?: PartnerAssetLimits;
  env?: Record<string, string | undefined>;
}): PartnerMimeDetection {
  const limits = input.limits ?? resolvePartnerAssetLimits(input.env ?? {});
  const detected = assertPartnerUploadAllowed({
    ...input,
    limits,
  });
  const real = detected.mime.toLowerCase().replace("image/jpg", "image/jpeg");
  if (!(PARTNER_ALLOWED_LOGO_MIMES as readonly string[]).includes(real)) {
    throw new PartnersDomainError(
      "VALIDATION",
      "Los logos nuevos solo admiten PNG o WEBP.",
      { mimeType: `Detectado: ${real}. JPG/JPEG/SVG no están válidos para logos.` },
    );
  }
  if (input.buffer.byteLength > limits.logoMaxBytes) {
    const mb = Math.max(1, Math.round(limits.logoMaxBytes / (1024 * 1024)));
    throw new PartnersDomainError(
      "VALIDATION",
      `Logo demasiado grande (máximo ${mb} MB). Comprimí el PNG/WEBP e intentá de nuevo.`,
      {
        fileSize: `Máximo ${limits.logoMaxBytes} bytes.`,
      },
    );
  }
  return detected;
}

/** Advertencia no bloqueante por resolución baja. */
export function partnerLogoResolutionWarning(
  width: number | null | undefined,
  height: number | null | undefined,
): string | null {
  const w = typeof width === "number" ? width : 0;
  const h = typeof height === "number" ? height : 0;
  if (w > 0 && w < 500) {
    return "Este archivo puede verse pixelado en algunos tamaños. Recomendamos subir una versión de mayor resolución.";
  }
  if (h > 0 && h < 500 && w > 0 && w <= h) {
    return "Este archivo puede verse pixelado en algunos tamaños. Recomendamos subir una versión de mayor resolución.";
  }
  return null;
}

export function assertValidCtaUrl(url: string | null | undefined): void {
  if (url == null || url.trim() === "") return;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new PartnersDomainError("VALIDATION", "CTA URL inválida.", {
      ctaUrl: "Debe ser una URL absoluta válida.",
    });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new PartnersDomainError("VALIDATION", "CTA URL inválida.", {
      ctaUrl: "Solo http/https.",
    });
  }
}

export function buildPartnerBrandStorageKey(input: {
  partnerId: string;
  assetId: string;
  filename: string;
}): string {
  const partnerId = assertSafeIdSegment(input.partnerId, "partnerId");
  const assetId = assertSafeIdSegment(input.assetId, "assetId");
  const filename = assertSafeStorageFilename(input.filename);
  return `partners/${partnerId}/brand/${assetId}/${filename}`;
}

export function buildPartnerParticipationStorageKey(input: {
  partnerId: string;
  participationId: string;
  assetId: string;
  filename: string;
}): string {
  const partnerId = assertSafeIdSegment(input.partnerId, "partnerId");
  const participationId = assertSafeIdSegment(input.participationId, "participationId");
  const assetId = assertSafeIdSegment(input.assetId, "assetId");
  const filename = assertSafeStorageFilename(input.filename);
  return `partners/${partnerId}/participations/${participationId}/${assetId}/${filename}`;
}

function assertSafeIdSegment(value: string, field: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value) || value.includes("..")) {
    throw new PartnersDomainError("VALIDATION", "ID inválido para storage.", {
      [field]: "Segmento de ruta inválido.",
    });
  }
  return value;
}
