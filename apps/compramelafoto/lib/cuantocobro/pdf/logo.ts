import type { PDFDocument } from "pdf-lib";
import { commercialInitialsFromLabel } from "./text";
import type { PdfLogoEmbedResult } from "./types";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;

  try {
    const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
    return { mime: match[1].toLowerCase(), bytes };
  } catch {
    return null;
  }
}

async function embedImageBytes(
  pdfDoc: PDFDocument,
  mime: string,
  bytes: Uint8Array,
): Promise<{ image: Awaited<ReturnType<PDFDocument["embedPng"]>>; width: number; height: number } | null> {
  const isPng = mime.includes("png") || bytes[0] === 0x89;
  const isJpg = mime.includes("jpeg") || mime.includes("jpg") || (bytes[0] === 0xff && bytes[1] === 0xd8);

  try {
    if (isPng) {
      const image = await pdfDoc.embedPng(bytes);
      return { image, width: image.width, height: image.height };
    }
    if (isJpg) {
      const image = await pdfDoc.embedJpg(bytes);
      return { image, width: image.width, height: image.height };
    }
  } catch {
    return null;
  }

  return null;
}

export type ResolvePdfLogoOptions = {
  logoUrl?: string | null;
  /** Intenta cada URL en orden hasta embeber una imagen válida. */
  logoUrls?: string[];
  fallbackLabel?: string | null;
  fetchImpl?: typeof fetch;
};

/**
 * Intenta embebir logo PNG/JPG desde URL http(s) o data URL.
 * Si falla, devuelve fallback con iniciales — nunca lanza.
 */
export async function resolvePdfLogo(
  pdfDoc: PDFDocument,
  options: ResolvePdfLogoOptions,
): Promise<PdfLogoEmbedResult> {
  const fallbackLabel = options.fallbackLabel?.trim() || "Logo";
  const fetchFn = options.fetchImpl ?? fetch;

  const candidates = [
    ...(options.logoUrls ?? []),
    ...(options.logoUrl?.trim() ? [options.logoUrl.trim()] : []),
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const logoUrl = candidate.trim();
    if (!logoUrl || seen.has(logoUrl)) continue;
    seen.add(logoUrl);

    const embedded = await tryEmbedLogoFromUrl(pdfDoc, logoUrl, fetchFn);
    if (embedded) return embedded;
  }

  return { kind: "fallback", label: commercialInitialsFromLabel(fallbackLabel) };
}

async function tryEmbedLogoFromUrl(
  pdfDoc: PDFDocument,
  logoUrl: string,
  fetchFn: typeof fetch,
): Promise<Extract<PdfLogoEmbedResult, { kind: "image" }> | null> {
  try {
    let payload: { mime: string; bytes: Uint8Array } | null = null;

    if (logoUrl.startsWith("data:")) {
      payload = parseDataUrl(logoUrl);
    } else if (/^https?:\/\//i.test(logoUrl)) {
      payload = await fetchImageBytesWithFetch(logoUrl, fetchFn);
    }

    if (!payload) return null;

    const embedded = await embedImageBytes(pdfDoc, payload.mime, payload.bytes);
    if (!embedded) return null;

    return {
      kind: "image",
      image: embedded.image,
      width: embedded.width,
      height: embedded.height,
    };
  } catch {
    return null;
  }
}

async function fetchImageBytesWithFetch(
  url: string,
  fetchFn: typeof fetch,
): Promise<{ mime: string; bytes: Uint8Array } | null> {
  const response = await fetchFn(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return null;

  const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) return null;

  return { mime, bytes };
}

export function scaleLogoToMaxBox(
  intrinsicWidth: number,
  intrinsicHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (intrinsicWidth <= 0 || intrinsicHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }

  const scale = Math.min(maxWidth / intrinsicWidth, maxHeight / intrinsicHeight, 1);
  return {
    width: intrinsicWidth * scale,
    height: intrinsicHeight * scale,
  };
}
