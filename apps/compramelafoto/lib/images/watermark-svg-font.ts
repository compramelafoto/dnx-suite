import fs from "fs";
import path from "path";
import { trazosDeTexto } from "@repo/design-studio";

/** Familia registrada en @font-face embebido (Roboto en assets). */
export const WATERMARK_FONT_FAMILY = "CLFWatermarkFont";

const FONT_CANDIDATES = [
  path.join(process.cwd(), "assets", "fonts", "Roboto-Regular.ttf"),
  path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf"),
];

let cachedFontBase64: string | null = null;
let cachedFontBytes: Uint8Array | null = null;

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
      cachedFontBytes = new Uint8Array(buf);
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

/**
 * Un texto de la marca de agua como `<path>`, con las letras ya dibujadas.
 *
 * librsvg (lo que usa sharp para pasar el SVG a imagen) ignora el `@font-face` incrustado y
 * busca la familia en el sistema. El servidor no tiene ninguna tipografía instalada, así que
 * cada letra salía como un cuadradito ("□□□□") sobre las fotos. En trazos no hace falta
 * ninguna: se dibujan con Roboto, el mismo archivo de `assets/fonts`.
 */
export function watermarkTextPath(input: {
  text: string;
  fontSize: number;
  x: number;
  y: number;
  /** "middle" centra el texto en x, como `text-anchor="middle"`. */
  anchor?: "start" | "middle";
  /** "middle" centra el texto en y, como `dominant-baseline="middle"`. */
  baseline?: "alphabetic" | "middle";
  /** Atributos de pintura (fill, stroke, opacidades, filtro) tal cual van en el `<path>`. */
  attrs: string;
}): string {
  loadFontBase64Sync();
  const archivo = cachedFontBytes!;
  const medida = trazosDeTexto({ archivo, texto: input.text, tamano: input.fontSize, x: 0, y: 0 });
  const x = input.anchor === "middle" ? input.x - medida.ancho / 2 : input.x;
  const y =
    input.baseline === "middle" ? input.y + (medida.ascendente - medida.descendente) / 2 : input.y;
  const { d } = trazosDeTexto({ archivo, texto: input.text, tamano: input.fontSize, x, y });
  return d ? `<path d="${d}" ${input.attrs}/>` : "";
}
