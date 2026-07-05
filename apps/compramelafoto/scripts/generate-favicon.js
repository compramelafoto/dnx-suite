#!/usr/bin/env node
/**
 * Genera icono optimizado para favicon desde watermark.png
 * Requiere: npm install sharp
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const inputPath = path.join(__dirname, "../public/watermark.png");
const outputDir = path.join(__dirname, "../app");

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error("No se encontró public/watermark.png");
    process.exit(1);
  }

  // icon.png: 32x32 para favicon (Next.js lo usa automáticamente)
  await sharp(inputPath)
    .resize(32, 32)
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(path.join(outputDir, "icon.png"));

  console.log("✓ app/icon.png generado (32x32)");

  // apple-icon.png: 180x180 para Apple touch icon
  await sharp(inputPath)
    .resize(180, 180)
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(path.join(outputDir, "apple-icon.png"));

  console.log("✓ app/apple-icon.png generado (180x180)");
  console.log("Next.js usará estos iconos automáticamente.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
