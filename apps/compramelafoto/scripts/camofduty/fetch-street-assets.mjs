#!/usr/bin/env node
/**
 * Baja y optimiza los modelos y texturas de la Calle 3D de Cam Of Duty.
 *
 * Fuente: Poly Haven (CC0) y Khronos glTF Sample Assets (CC BY 4.0).
 * Salida: public/camofduty/street/{models,textures}/ + CREDITOS.md
 *
 * Uso (desde apps/compramelafoto):
 *   node scripts/camofduty/fetch-street-assets.mjs
 *
 * Requiere `npx` (usa @gltf-transform/cli sin agregarlo al proyecto) y
 * `cwebp` (brew install webp). Los modelos salen en .glb con geometría
 * meshopt y texturas WebP; las piezas del kit de fachadas conservan sus
 * nombres porque la escena las instancia por nombre.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const OUT = join(process.cwd(), "public/camofduty/street");
const GLTF_TRANSFORM = ["-y", "@gltf-transform/cli@4.1.1"];

/** Modelos: id de Poly Haven → archivo, resolución de texturas y tamaño máximo. */
const MODELS = [
  { id: "modular_urban_apartments_facade", file: "facade-kit.glb", res: "2k", size: 2048, keepNodes: true },
  { id: "rollershutter_door", file: "rollershutter-door.glb", res: "1k", size: 1024 },
  { id: "street_lamp_01", file: "street-lamp.glb", res: "1k", size: 1024 },
  { id: "fire_hydrant", file: "fire-hydrant.glb", res: "1k", size: 512 },
  { id: "metal_trash_can", file: "trash-can.glb", res: "1k", size: 512 },
  { id: "modular_street_seating", file: "street-bench.glb", res: "1k", size: 1024, keepNodes: true },
  { id: "utility_box_01", file: "utility-box.glb", res: "1k", size: 512 },
  { id: "water_manhole_cover", file: "manhole.glb", res: "1k", size: 512 },
  { id: "exterior_aircon_unit", file: "aircon.glb", res: "1k", size: 512 },
  { id: "potted_plant_02", file: "potted-plant.glb", res: "1k", size: 512 },
  { id: "jacaranda_tree", file: "tree-jacaranda.glb", res: "1k", size: 1024, simplify: 0.04 },
  // Versión lejana del árbol (a más de ~25 m alcanza con una décima parte).
  { id: "jacaranda_tree", file: "tree-jacaranda-far.glb", res: "1k", size: 512, simplify: 0.006 },
  { id: "covered_car", file: "covered-car.glb", res: "1k", size: 1024 },
];

/** Texturas de piso: id de Poly Haven → nombre corto. */
const TEXTURES = [
  { id: "asphalt_02", name: "asphalt", res: "2k" },
  { id: "concrete_tiles", name: "sidewalk", res: "2k" },
  { id: "brushed_concrete_03", name: "curb", res: "1k" },
];

/** Auto (CC BY 4.0, requiere atribución). */
const CAR_URL =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function download(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}

function optimize(input, output, { size, keepNodes = false, simplify }) {
  const args = [
    ...GLTF_TRANSFORM,
    "optimize",
    input,
    output,
    "--compress",
    // Meshopt cuantiza y mueve parte de la posición al nodo; las piezas que se
    // instancian por nombre necesitan la geometría tal cual (Draco no la mueve).
    keepNodes ? "draco" : "meshopt",
    "--texture-compress",
    "webp",
    "--texture-size",
    String(size),
    "--instance",
    "false",
  ];
  if (keepNodes) args.push("--join", "false", "--flatten", "false", "--palette", "false");
  // El error por defecto (0,0001) casi no deja simplificar: las hojas admiten 5 %.
  if (simplify) args.push("--simplify-ratio", String(simplify), "--simplify-error", "0.05");
  else args.push("--simplify", "false");
  execFileSync("npx", args, { stdio: "inherit" });
}

async function fetchModel(model, work) {
  const files = await getJson(`https://api.polyhaven.com/files/${model.id}`);
  const gltf = files.gltf[model.res].gltf;
  const dir = join(work, model.id);
  await download(gltf.url, join(dir, "model.gltf"));
  await Promise.all(
    Object.entries(gltf.include ?? {}).map(([rel, file]) => download(file.url, join(dir, rel))),
  );
  optimize(join(dir, "model.gltf"), join(OUT, "models", model.file), model);
}

async function fetchTexture(tex) {
  const files = await getJson(`https://api.polyhaven.com/files/${tex.id}`);
  const maps = { diff: files.Diffuse, nor: files.nor_gl, arm: files.arm };
  for (const [kind, entry] of Object.entries(maps)) {
    const jpg = entry?.[tex.res]?.jpg?.url;
    if (!jpg) throw new Error(`Falta ${kind} ${tex.res} en ${tex.id}`);
    const tmp = join(tmpdir(), `${tex.name}-${kind}.jpg`);
    await download(jpg, tmp);
    const out = join(OUT, "textures", `${tex.name}_${kind}.webp`);
    mkdirSync(dirname(out), { recursive: true });
    execFileSync("cwebp", ["-quiet", "-q", kind === "diff" ? "82" : "88", tmp, "-o", out]);
    rmSync(tmp);
  }
}

const CREDITS = `# Créditos — Calle 3D de Cam Of Duty

Contenidos pedagógicos basados en los apuntes de la profesora Débora Priasco.

## Poly Haven (CC0, dominio público) — https://polyhaven.com
${MODELS.map((m) => `- \`models/${m.file}\` — ${m.id}`).join("\n")}
${TEXTURES.map((t) => `- \`textures/${t.name}_*.webp\` — ${t.id}`).join("\n")}

## Khronos glTF Sample Assets (CC BY 4.0)
- \`models/car-concept.glb\` — CarConcept, © 2024 Darmstadt Graphics Group GmbH; modelo y
  texturas de Eric Chadwick.

## Microsoft Rocketbox Avatar Library (MIT)
- Peatones y animaciones: \`public/camofduty/models/figures/\` y \`models/animations/\`.

Generado con \`node scripts/camofduty/fetch-street-assets.mjs\`.
`;

async function main() {
  const work = mkdtempSync(join(tmpdir(), "cod-street-"));
  mkdirSync(join(OUT, "models"), { recursive: true });
  try {
    for (const model of MODELS) {
      if (existsSync(join(OUT, "models", model.file)) && !process.argv.includes("--force")) continue;
      console.log(`→ ${model.id}`);
      await fetchModel(model, work);
    }
    for (const tex of TEXTURES) {
      console.log(`→ textura ${tex.id}`);
      await fetchTexture(tex);
    }
    const carRaw = join(work, "car.glb");
    await download(CAR_URL, carRaw);
    optimize(carRaw, join(OUT, "models", "car-concept.glb"), { size: 1024 });
    // Versión lejana del auto para el tránsito y los estacionados lejos.
    optimize(carRaw, join(OUT, "models", "car-concept-far.glb"), { size: 512, simplify: 0.06 });
    writeFileSync(join(OUT, "CREDITOS.md"), CREDITS);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
