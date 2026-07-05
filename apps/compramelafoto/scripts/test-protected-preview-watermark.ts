/**
 * Prueba visual del watermark de preview protegido (texto legible, sin tofu).
 *
 * Uso:
 *   npx tsx scripts/test-protected-preview-watermark.ts input.jpg
 *   PROTECTED_PREVIEW_WATERMARK=1 PROTECTED_PREVIEW_WATERMARK_MODE=strong npx tsx scripts/test-protected-preview-watermark.ts in.jpg
 *
 * Genera en el mismo directorio que el input:
 *   <base>-simple.jpg, <base>-collaborative.jpg, <base>-school.jpg
 */
import fs from "fs/promises";
import path from "path";
import {
  applyProtectedPreviewWatermark,
  getProtectedPreviewWatermarkMode,
  isProtectedPreviewWatermarkEnabled,
} from "../lib/images/protected-preview-watermark";

const ALBUM_TYPES = ["SIMPLE", "COLLABORATIVE", "SCHOOL"] as const;

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error("Uso: npx tsx scripts/test-protected-preview-watermark.ts <input.jpg>");
    process.exit(1);
  }

  const absIn = path.resolve(inputPath);
  const dir = path.dirname(absIn);
  const base = path.basename(absIn, path.extname(absIn));

  if (!isProtectedPreviewWatermarkEnabled()) {
    console.warn(
      "⚠️  PROTECTED_PREVIEW_WATERMARK no está activo. El script aplica el watermark igualmente para prueba local."
    );
  }

  const buffer = await fs.readFile(absIn);
  const mode = getProtectedPreviewWatermarkMode();

  for (const albumType of ALBUM_TYPES) {
    const absOut = path.join(dir, `${base}-${albumType.toLowerCase()}.jpg`);
    const out = await applyProtectedPreviewWatermark(buffer, {
      photoId: 12345,
      mode,
      showPhotoId: true,
      maxSide: 1200,
      albumType,
      previewType: "preview",
    });
    await fs.writeFile(absOut, out);
    console.log(`✅ ${albumType}: ${absOut} (${out.length} bytes, mode=${mode})`);
  }

  console.log("\nRevisá que el texto sea legible (sin cuadrados) en las tres variantes.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
