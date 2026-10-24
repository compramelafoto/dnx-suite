#!/usr/bin/env node
/**
 * Baja los avatares deportivos de Microsoft Rocketbox (MIT) para los corredores
 * de la Calle 3D: cuerpo (model.fbx), cuerpo con formas de cara
 * (model-facial.fbx), texturas (TGA → JPG de 1024 px) y miniatura. Además baja
 * las animaciones de correr a una carpeta temporal para convertirlas.
 *
 * Uso (desde apps/compramelafoto):
 *   node scripts/camofduty/fetch-rocketbox-sports.mjs <carpeta-temporal-para-animaciones>
 *   pnpm exec tsx scripts/camofduty/convert-rocketbox-animations.ts <esa-carpeta>
 *
 * Salida: public/camofduty/models/figures/<carpeta>/ y, tras convertir,
 * public/camofduty/models/animations/{f,m}_run_*.json
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const FIGURES_DIR = join(process.cwd(), "public/camofduty/models/figures");
const RAW = "https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets";
const FOLDERS = ["Sports_Female_01", "Sports_Female_02", "Sports_Male_01", "Sports_Male_02"];
const ANIMATIONS = ["f_run_slow_01", "m_run_slow_01", "f_run_neutral_01", "m_run_neutral_01"];

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Lector mínimo de TGA (color verdadero de 24/32 bits, sin comprimir o RLE). */
function decodeTga(buf) {
  const idLength = buf[0];
  const type = buf[2];
  const width = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  const bpp = buf[16] / 8;
  const topToBottom = (buf[17] & 0x20) !== 0;
  if (type !== 2 && type !== 10) throw new Error(`TGA tipo ${type} no soportado`);
  if (bpp !== 3 && bpp !== 4) throw new Error(`TGA de ${bpp * 8} bits no soportado`);
  const pixels = Buffer.alloc(width * height * bpp);
  let src = 18 + idLength;
  if (type === 2) {
    buf.copy(pixels, 0, src, src + pixels.length);
  } else {
    let dst = 0;
    while (dst < pixels.length) {
      const head = buf[src++];
      const count = (head & 0x7f) + 1;
      if (head & 0x80) {
        for (let i = 0; i < count; i++) buf.copy(pixels, dst + i * bpp, src, src + bpp);
        src += bpp;
      } else {
        buf.copy(pixels, dst, src, src + count * bpp);
        src += count * bpp;
      }
      dst += count * bpp;
    }
  }
  // BGR(A) → RGB(A), y las filas de arriba hacia abajo.
  const rgb = Buffer.alloc(pixels.length);
  for (let y = 0; y < height; y++) {
    const row = topToBottom ? y : height - 1 - y;
    for (let x = 0; x < width; x++) {
      const s = (row * width + x) * bpp;
      const d = (y * width + x) * bpp;
      rgb[d] = pixels[s + 2];
      rgb[d + 1] = pixels[s + 1];
      rgb[d + 2] = pixels[s];
      if (bpp === 4) rgb[d + 3] = pixels[s + 3];
    }
  }
  return { data: rgb, width, height, channels: bpp };
}

async function tgaTo(url, out, format) {
  const tga = decodeTga(await download(url));
  const img = sharp(tga.data, { raw: { width: tga.width, height: tga.height, channels: tga.channels } }).resize(1024, 1024, { fit: "inside" });
  await (format === "png" ? img.png() : img.removeAlpha().jpeg({ quality: 86 })).toFile(out);
}

for (const folder of FOLDERS) {
  const dir = join(FIGURES_DIR, folder);
  mkdirSync(dir, { recursive: true });
  const base = `${RAW}/Avatars/Professions/${folder}`;
  if (!existsSync(join(dir, "model.fbx"))) writeFileSync(join(dir, "model.fbx"), await download(`${base}/Export/${folder}.fbx`));
  if (!existsSync(join(dir, "model-facial.fbx"))) writeFileSync(join(dir, "model-facial.fbx"), await download(`${base}/Export/${folder}_facial.fbx`));
  // Prefijo de las texturas (f021, m021…): sale del árbol del repositorio.
  const tree = await (await fetch("https://api.github.com/repos/microsoft/Microsoft-Rocketbox/git/trees/master?recursive=1")).json();
  const textures = tree.tree.map((t) => t.path).filter((p) => p.startsWith(`Assets/Avatars/Professions/${folder}/Textures/`) && p.endsWith(".tga"));
  for (const path of textures) {
    const name = path.split("/").pop().replace(/\.tga$/, "");
    if (name.endsWith("_specular")) continue;
    const opacity = name.includes("_opacity");
    const out = join(dir, `${name}.${opacity ? "png" : "jpg"}`);
    if (!existsSync(out)) await tgaTo(`${RAW}/../${path}`, out, opacity ? "png" : "jpg");
  }
  if (!existsSync(join(dir, "thumb.jpg"))) {
    await sharp(await download(`${base}/${folder}.png`)).resize(96, 96, { fit: "cover" }).flatten({ background: "#20232a" }).jpeg({ quality: 80 }).toFile(join(dir, "thumb.jpg"));
  }
  console.log(`${folder}: listo (${textures.length} texturas)`);
}

const animDir = process.argv[2];
if (animDir) {
  mkdirSync(animDir, { recursive: true });
  for (const name of ANIMATIONS) {
    writeFileSync(join(animDir, `${name}.max.fbx`), await download(`${RAW}/Animations/all_animations_max_motextr_xy/${name}.max.fbx`));
    console.log(`${name}: bajada`);
  }
}
