/**
 * Regenera `app/lib/fotorank/partners/sponsor-card-logo-asset.ts`.
 *
 * El logo va embebido como data URL porque el render de placas corre sobre
 * `about:blank` (Playwright `setContent`) o en el worker remoto: una ruta
 * relativa `/fotorank-logo.png` no resuelve contra ningún origen.
 *
 * Uso: pnpm --filter fotorank build:card-logo
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const SOURCE = "public/fotorank-logo.png";
const OPTIMIZED = "public/brand/cards/fotorank-logo-card.png";
const TARGET = "app/lib/fotorank/partners/sponsor-card-logo-asset.ts";
const WIDTH = 512;

async function main() {
// El original es un cuadrado con mucho margen transparente: sin recortar, el
// logo queda diminuto dentro del bloque de la placa.
const png = await sharp(SOURCE)
  .trim()
  .resize({ width: WIDTH, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toBuffer();

writeFileSync(OPTIMIZED, png);

const base64 = png.toString("base64");
const chunks: string[] = [];
for (let i = 0; i < base64.length; i += 120) {
  chunks.push(base64.slice(i, i + 120));
}

const BACKTICK = String.fromCharCode(96);
const header = [
  "/**",
  ` * Logo FotoRank embebido (${WIDTH}px de ancho, PNG optimizado) para las placas.`,
  " *",
  " * Se embebe como data URL en vez de referenciar `/fotorank-logo.png` porque el",
  " * render corre sobre `about:blank` o en el worker remoto: una ruta relativa no",
  " * resuelve contra ningún origen.",
  " *",
  " * Regenerar con `scripts/build-card-logo.ts` si cambia la marca.",
  " */",
  "// Troceado en un array: una concatenación de cientos de `+` desborda la pila",
  "// del parser de ESLint.",
  "const FOTORANK_CARD_LOGO_BASE64_CHUNKS = [",
].join("\n");

const body = chunks.map((c) => `  "${c}",`).join("\n");

const footer = [
  '].join("");',
  "",
  "export const FOTORANK_CARD_LOGO_DATA_URL =",
  "  " + BACKTICK + "data:image/png;base64,${FOTORANK_CARD_LOGO_BASE64_CHUNKS}" + BACKTICK + ";",
  "",
].join("\n");

writeFileSync(TARGET, `${header}\n${body}\n${footer}`);

console.log(`[build-card-logo] ${png.length} bytes PNG -> ${TARGET}`);
}

void main();
