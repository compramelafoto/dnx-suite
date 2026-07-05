#!/usr/bin/env node
/**
 * Descarga GLB de prueba (Khronos glTF Sample Models) y deja instrucciones Mixamo.
 *
 * Uso:
 *   node scripts/camofduty/setup-pedestrian-glbs.mjs
 *   node scripts/camofduty/setup-pedestrian-glbs.mjs --mixamo-only
 *
 * Los archivos Khronos son placeholders CC BY 4.0 para validar pipeline.
 * Reemplazalos por modelos Mixamo realistas cuando estén listos.
 */

import { createWriteStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PED_DIR = join(ROOT, "public/camofduty/assets/pedestrians");
const PROPS_DIR = join(ROOT, "public/camofduty/assets/props");

const KHRONOS = {
  cesiumMan:
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb",
  riggedFigure:
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/RiggedFigure/glTF-Binary/RiggedFigure.glb",
};

const MIXAMO_GUIDE = `
═══════════════════════════════════════════════════════════════
  Mixamo — reemplazar placeholders por personajes realistas
═══════════════════════════════════════════════════════════════

1. https://www.mixamo.com → elegir personaje (~1.7 m)
2. Animaciones:
   - pedestrian-main.glb  → "Walking" (In Place OFF, 30 FPS)
   - pedestrian-02.glb    → otro personaje + "Walking"
   - pedestrian-seated.glb → "Sitting" o "Sitting Idle"
3. Export: FBX o glTF → convertir a GLB si hace falta (Blender / gltfpack)
4. Colocar en public/camofduty/assets/pedestrians/
5. Pies en y=0, escala en metros, materiales PBR
6. Ajustar rotation en photographic-block-manifest.ts si mira al revés

bench-east.glb → modelo de banco PBR en public/camofduty/assets/props/
`;

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al descargar ${url}`);
  }
  await pipeline(res.body, createWriteStream(dest));
  console.info(`✓ ${dest}`);
}

async function main() {
  const mixamoOnly = process.argv.includes("--mixamo-only");

  if (mixamoOnly) {
    console.info(MIXAMO_GUIDE);
    return;
  }

  await mkdir(PED_DIR, { recursive: true });
  await mkdir(PROPS_DIR, { recursive: true });

  console.info("Descargando placeholders Khronos (CC BY 4.0)…\n");

  const mainPath = join(PED_DIR, "pedestrian-main.glb");
  const seatedPath = join(PED_DIR, "pedestrian-seated.glb");
  const secondPath = join(PED_DIR, "pedestrian-02.glb");

  await download(KHRONOS.cesiumMan, mainPath);
  await copyFile(mainPath, seatedPath);
  console.info(`✓ ${seatedPath} (copia de main — reemplazar por pose sentada Mixamo)`);

  await download(KHRONOS.riggedFigure, secondPath);

  console.info("\nPlaceholders listos. Probá Ciudad Fotográfica Experimental.");
  console.info(MIXAMO_GUIDE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
