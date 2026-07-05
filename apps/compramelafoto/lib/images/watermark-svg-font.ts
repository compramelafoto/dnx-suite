import fs from "fs";
import path from "path";

/** Familia registrada en @font-face embebido (Roboto en assets). */
export const WATERMARK_FONT_FAMILY = "CLFWatermarkFont";

const FONT_CANDIDATES = [
  path.join(process.cwd(), "assets", "fonts", "Roboto-Regular.ttf"),
  path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf"),
];

let cachedFontBase64: string | null = null;

function isValidTrueTypeFont(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const sig = buf.subarray(0, 4).toString("ascii");
  return sig === "\x00\x01\x00\x00" || sig === "true" || sig === "OTTO";
}

function loadFontBase64Sync(): string {
  if (cachedFontBase64) return cachedFontBase64;

  for (const fontPath of FONT_CANDIDATES) {
    try {
      const buf = fs.readFileSync(fontPath);
      if (!isValidTrueTypeFont(buf)) {
        console.warn("[watermark-svg-font] archivo ignorado (no es TTF válido):", fontPath);
        continue;
      }
      cachedFontBase64 = buf.toString("base64");
      return cachedFontBase64;
    } catch {
      /* siguiente candidato */
    }
  }

  throw new Error(
    "[watermark-svg-font] No se encontró Roboto-Regular.ttf válido en assets/fonts (requerido para marcas de agua con texto)."
  );
}

/** Bloque `<style>` con TTF embebido para que librsvg/sharp renderice texto (sin tofu). */
export function buildSvgEmbeddedFontDefs(): string {
  const b64 = loadFontBase64Sync();
  return `<style type="text/css"><![CDATA[
    @font-face {
      font-family: '${WATERMARK_FONT_FAMILY}';
      src: url('data:font/truetype;charset=utf-8;base64,${b64}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  ]]></style>`;
}

export function watermarkFontFamilyCss(): string {
  return `'${WATERMARK_FONT_FAMILY}', Arial, Helvetica, sans-serif`;
}

/**
 * Solo ASCII imprimible para overlays SVG en producción (evita tofu y glifos raros).
 * Normaliza acentos y reemplaza separadores unicode por ASCII.
 */
export function sanitizeWatermarkAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[•·▪►]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
