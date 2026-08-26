/**
 * Regenera `lib/participant-cards/participant-card-branding-logo.ts`.
 *
 * El logo va embebido como data URL porque el render de placas corre sobre
 * `about:blank` (Playwright `setContent`) o en el worker remoto: una ruta
 * relativa `/brand/...` no resuelve contra ningún origen.
 *
 * Uso: pnpm --filter clickaton tsx scripts/build-card-logo.ts
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const SOURCE = "public/brand/downloads/logos/clickaton-principal-v3-color.png";
const OPTIMIZED = "public/brand/cards/clickaton-logo-card.png";
const TARGET = "lib/participant-cards/participant-card-branding-logo.ts";
const WIDTH = 512;

const png = await sharp(SOURCE)
  .resize({ width: WIDTH, withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toBuffer();

writeFileSync(OPTIMIZED, png);

const base64 = png.toString("base64");
const chunks: string[] = [];
for (let i = 0; i < base64.length; i += 120) {
  chunks.push(base64.slice(i, i + 120));
}

const body = chunks.map((c) => `  "${c}",`).join("\n");

writeFileSync(
  TARGET,
  `/**
 * Logo Clickatón embebido (${WIDTH}px de ancho, PNG optimizado) para las placas.
 *
 * Se embebe como data URL en vez de referenciar \`/brand/...\` porque el render
 * corre sobre \`about:blank\` (Playwright \`setContent\`) o en el worker remoto:
 * una ruta relativa no resuelve contra ningún origen y el logo quedaba vacío.
 *
 * Regenerar con \`scripts/build-card-logo.ts\` si cambia la marca.
 */
// Troceado en un array: una concatenación de cientos de \`+\` desborda la pila
// del parser de ESLint.
const CLICKATON_CARD_LOGO_BASE64_CHUNKS = [
${body}
].join("");

export const CLICKATON_CARD_LOGO_DATA_URL =
  \`data:image/png;base64,\${CLICKATON_CARD_LOGO_BASE64_CHUNKS}\`;
`
);

console.log(`[build-card-logo] ${png.length} bytes PNG -> ${TARGET}`);
