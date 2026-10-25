#!/usr/bin/env node
/**
 * Baja la versión "_facial" de los avatares Microsoft Rocketbox (MIT): el
 * mismo cuerpo y esqueleto que model.fbx, más 175 formas de cara (ARKit,
 * visemas y unidades de acción). La usan los peatones de la Calle 3D para
 * parpadear, sonreír, enojarse y mover la boca al hablar.
 *
 * Uso (desde apps/compramelafoto):
 *   node scripts/camofduty/fetch-rocketbox-facial.mjs
 * Salida: public/camofduty/models/figures/<carpeta>/model-facial.fbx
 */

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIGURES_DIR = join(process.cwd(), "public/camofduty/models/figures");
const BASE = "https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/Assets/Avatars/Adults";

const folders = readdirSync(FIGURES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const folder of folders) {
  const out = join(FIGURES_DIR, folder, "model-facial.fbx");
  if (existsSync(out) && !process.argv.includes("--force")) continue;
  const res = await fetch(`${BASE}/${folder}/Export/${folder}_facial.fbx`);
  if (!res.ok) {
    console.warn(`${folder}: ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.subarray(0, 18).toString("latin1").startsWith("Kaydara FBX Binary")) {
    console.warn(`${folder}: no es un FBX`);
    continue;
  }
  writeFileSync(out, buf);
  console.log(`${folder}: ${(buf.length / 1e6).toFixed(1)} MB`);
}
