import { readFromR2Detailed, urlToR2Key } from "@/lib/r2-client";

export type VariantSourceKind = "preview" | "original";

export type VariantSourceDiagnostic = {
  photoId: number;
  albumId: number;
  previewUrl: string | null;
  originalKey: string | null;
  sourceKey: string | null;
  sourceUsed: VariantSourceKind | null;
  bufferBytes: number;
  headHex32: string;
  contentType: string | null;
  looksLikeText: boolean;
  textSignature: string | null;
  imageFormat: string | null;
  errorMessage?: string;
};

export class PhotoVariantSourceError extends Error {
  readonly diagnostic: VariantSourceDiagnostic;

  constructor(message: string, diagnostic: VariantSourceDiagnostic) {
    super(message);
    this.name = "PhotoVariantSourceError";
    this.diagnostic = diagnostic;
  }
}

const TEXT_PREFIXES = ["<!DOCTYPE", "<!doctype", "<html", "<HTML", "<?xml", "{"] as const;

export function bufferHeadHex32(buffer: Buffer): string {
  return buffer.subarray(0, Math.min(32, buffer.length)).toString("hex");
}

export function detectTextSignature(buffer: Buffer): string | null {
  if (buffer.length === 0) return "empty";
  const head = buffer.subarray(0, Math.min(256, buffer.length)).toString("utf8").trimStart();
  for (const prefix of TEXT_PREFIXES) {
    if (head.startsWith(prefix)) return prefix;
  }
  return null;
}

export function detectImageFormat(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return "heif/avif";
  }
  return null;
}

export function validateImageBuffer(buffer: Buffer): string {
  if (buffer.length < 16) {
    throw new Error("Buffer too small to be a valid image");
  }
  const textSignature = detectTextSignature(buffer);
  if (textSignature) {
    throw new Error(`Non-image text content detected (${textSignature})`);
  }
  const format = detectImageFormat(buffer);
  if (!format) {
    throw new Error("Input buffer contains unsupported image format");
  }
  if (format === "heif/avif") {
    throw new Error(`Unsupported container format for variant pipeline (${format})`);
  }
  return format;
}

/** Convierte previewUrl almacenada (URL pública o key) a key R2 — nunca hace HTTP fetch. */
export function resolvePreviewR2KeyFromPreviewUrl(previewUrl?: string | null): string | null {
  const raw = previewUrl?.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const key = urlToR2Key(raw);
      return key.replace(/^\//, "") || null;
    } catch {
      return null;
    }
  }
  return raw.replace(/^\//, "") || null;
}

/** Key R2 del original (URL o path) — solo uso server-side (backfill/upload). */
export function resolveOriginalR2KeyFromStored(originalKey?: string | null): string | null {
  const raw = originalKey?.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      return urlToR2Key(raw).replace(/^\//, "") || null;
    } catch {
      return null;
    }
  }
  return raw.replace(/^\//, "") || null;
}

/** Deriva key preview_* desde original_* (legacy). */
export function derivePreviewR2KeyFromOriginalKey(originalKey: string): string | null {
  const normalized = resolveOriginalR2KeyFromStored(originalKey);
  if (!normalized || !normalized.includes("original_")) return null;
  return normalized.replace(/original_/, "preview_");
}

function buildDiagnosticBase(params: {
  photoId: number;
  albumId: number;
  previewUrl?: string | null;
  originalKey?: string | null;
}): Omit<
  VariantSourceDiagnostic,
  "sourceKey" | "sourceUsed" | "bufferBytes" | "headHex32" | "contentType" | "looksLikeText" | "textSignature" | "imageFormat"
> {
  return {
    photoId: params.photoId,
    albumId: params.albumId,
    previewUrl: params.previewUrl?.trim() || null,
    originalKey: params.originalKey?.trim() || null,
  };
}

function diagnosticWithBuffer(
  base: ReturnType<typeof buildDiagnosticBase>,
  partial: {
    sourceKey: string | null;
    sourceUsed: VariantSourceKind | null;
    buffer: Buffer;
    contentType: string | null;
    errorMessage?: string;
  }
): VariantSourceDiagnostic {
  const textSignature = detectTextSignature(partial.buffer);
  return {
    ...base,
    sourceKey: partial.sourceKey,
    sourceUsed: partial.sourceUsed,
    bufferBytes: partial.buffer.length,
    headHex32: bufferHeadHex32(partial.buffer),
    contentType: partial.contentType,
    looksLikeText: textSignature != null,
    textSignature,
    imageFormat: partial.buffer.length > 0 ? detectImageFormat(partial.buffer) : null,
    errorMessage: partial.errorMessage,
  };
}

async function tryReadValidImageSource(params: {
  sourceKey: string;
  sourceUsed: VariantSourceKind;
  base: ReturnType<typeof buildDiagnosticBase>;
}): Promise<{ buffer: Buffer; diagnostic: VariantSourceDiagnostic } | null> {
  let buffer = Buffer.alloc(0);
  let contentType: string | null = null;

  try {
    const read = await readFromR2Detailed(params.sourceKey);
    buffer = Buffer.from(read.buffer);
    contentType = read.contentType;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const diagnostic = diagnosticWithBuffer(params.base, {
      sourceKey: params.sourceKey,
      sourceUsed: params.sourceUsed,
      buffer,
      contentType,
      errorMessage: `r2_read: ${message}`,
    });
    console.warn("[photo-variant] source_read_failed", JSON.stringify(diagnostic));
    return null;
  }

  try {
    const format = validateImageBuffer(buffer);
    const diagnostic = diagnosticWithBuffer(params.base, {
      sourceKey: params.sourceKey,
      sourceUsed: params.sourceUsed,
      buffer,
      contentType,
    });
    diagnostic.imageFormat = format;
    return { buffer, diagnostic };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const diagnostic = diagnosticWithBuffer(params.base, {
      sourceKey: params.sourceKey,
      sourceUsed: params.sourceUsed,
      buffer,
      contentType,
      errorMessage: message,
    });
    console.warn("[photo-variant] source_invalid", JSON.stringify(diagnostic));
    return null;
  }
}

/**
 * Carga buffer de imagen para generar variantes (solo servidor).
 * Orden: original (mejor tono) → previewUrl → preview derivada de originalKey.
 */
export async function loadVariantGenerationSourceBuffer(params: {
  photoId: number;
  albumId: number;
  previewUrl?: string | null;
  originalKey?: string | null;
}): Promise<{ buffer: Buffer; diagnostic: VariantSourceDiagnostic }> {
  const base = buildDiagnosticBase(params);
  const candidates: Array<{ sourceKey: string; sourceUsed: VariantSourceKind }> = [];

  if (params.originalKey?.trim()) {
    const original = resolveOriginalR2KeyFromStored(params.originalKey);
    if (original) {
      candidates.push({ sourceKey: original, sourceUsed: "original" });
    }
  }

  const previewFromUrl = resolvePreviewR2KeyFromPreviewUrl(params.previewUrl);
  if (previewFromUrl && !candidates.some((c) => c.sourceKey === previewFromUrl)) {
    candidates.push({ sourceKey: previewFromUrl, sourceUsed: "preview" });
  }

  if (params.originalKey?.trim()) {
    const derivedPreview = derivePreviewR2KeyFromOriginalKey(params.originalKey);
    if (derivedPreview && !candidates.some((c) => c.sourceKey === derivedPreview)) {
      candidates.push({ sourceKey: derivedPreview, sourceUsed: "preview" });
    }
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    const result = await tryReadValidImageSource({ ...candidate, base });
    if (result) {
      console.info("[photo-variant] source_ok", JSON.stringify(result.diagnostic));
      return result;
    }
    const lastKey = candidate.sourceKey;
    errors.push(`${candidate.sourceUsed}:${lastKey}`);
  }

  const diagnostic = diagnosticWithBuffer(base, {
    sourceKey: candidates[0]?.sourceKey ?? null,
    sourceUsed: null,
    buffer: Buffer.alloc(0),
    contentType: null,
    errorMessage: errors.length
      ? `No valid image source found (${errors.join("; ")})`
      : "No valid image source found",
  });
  throw new PhotoVariantSourceError(diagnostic.errorMessage ?? "No valid image source found", diagnostic);
}
