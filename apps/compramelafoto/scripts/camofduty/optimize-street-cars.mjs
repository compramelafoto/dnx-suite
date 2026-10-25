#!/usr/bin/env node
/**
 * Optimiza los autos, bicis, monopatines y motos de la Calle 3D de Cam Of Duty.
 *
 * Fuente: Sketchfab (CC BY 4.0, requiere atribución). Sketchfab sólo deja
 * bajar con sesión iniciada, así que los .glb se bajan a mano (versión
 * "glb" más liviana de cada página) con el nombre `cod-car-<id>.glb` para los
 * autos y `cod-<id>.glb` para el resto.
 *
 * Uso (desde apps/compramelafoto):
 *   node scripts/camofduty/optimize-street-cars.mjs <carpeta-con-los-glb>
 *
 * Salida: public/camofduty/street/models/cars/<id>.glb y models/rides/<id>.glb
 * (geometría meshopt, texturas WebP de 512 px) y sus secciones de CREDITOS.md.
 * La escala y la orientación de cada modelo se corrigen en
 * lib/simulator/street/street-cars.ts y street-rides.ts.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public/camofduty/street");
const GLTF_TRANSFORM = ["-y", "@gltf-transform/cli@4.1.1"];

/**
 * id → página de Sketchfab, autor y cuánto simplificar (fracción de triángulos;
 * `error` sube el desvío permitido cuando el modelo no se deja reducir).
 */
export const CARS = [
  { id: "fiat-uno-1994", name: "Fiat Uno 1994", author: "ARDmation", uid: "e81d01b9513947ac9e223fff1e669eff" },
  { id: "volkswagen-golf-ii", name: "Volkswagen Golf II", author: "ARDmation", uid: "740500f10bc94e7a91c2290e445fcb39" },
  { id: "fiat-uno-2001", name: "Fiat Uno 2001", author: "B.M.A", uid: "cf685e42e7b54f348f6d5c145f1175dc", simplify: 0.35 },
  { id: "2000-dacia-sandero", name: "2000 Dacia Sandero", author: "tonielpro520", uid: "313c05fa917f451eae848dd361404a85", simplify: 0.35, error: 0.02 },
  { id: "2016-volkswagen-polo", name: "2016 Volkswagen Polo", author: "BHP3D", uid: "bab77902c638427bb85e68b6762a481f", simplify: 0.2 },
  { id: "ford-ranger-2002", name: "Ford Ranger 2002", author: "David_Holiday", uid: "63515c5e20914d6496d1470ddc366a78", simplify: 0.2 },
  { id: "renault-12", name: "Renault 12", author: "mrcyb", uid: "mCBsIrYpTaSzshyZuLfSN6mIPfW", simplify: 0.25 },
  { id: "ford-falcon", name: "Ford Falcon GT 1973", author: "tomm8", uid: "13d628c752db4ae0acb755e3ba927aa0", simplify: 0.35 },
  { id: "peugeot-504", name: "Peugeot 504 break", author: "medraphc", uid: "71831821ad8a4884b78b5996e6039fc5" },
  { id: "renault-logan", name: "Renault Logan 2004", author: "goooddenis", uid: "e4f9463f6e004b90bb977d12f6375b9c" },
  { id: "ford-focus", name: "Ford Focus Sedan", author: "speedmodel", uid: "ed2e9355b8a64e6a8700973df1a5b8f0", simplify: 0.35 },
  { id: "peugeot-405", name: "1994 Peugeot 405 GLX", author: "Mehrdad995GTa", uid: "b9b69099434c45bdb3265417dd720752" },
  { id: "renault-duster", name: "2011 Dacia (Renault) Duster", author: "razor24", uid: "30bc2e09de66426bb67be72c95fa2476" },
];

/** Bicis, monopatines y motos (`cod-<id>.glb`). */
export const RIDES = [
  { id: "bici-clasica", file: "bici_clasica", name: "Classic Bicycle | LowPoly | Game ready", author: "by__Rx", uid: "da6507928c0c4a5c8776008cdb9f747e" },
  { id: "bici-amarilla", file: "bici_amarilla", name: "Yellow bicycle", author: "volkovatatyana", uid: "4cc719f387cb4cb4aea6e12a27e06e2e" },
  { id: "triciclo", file: "bici_longtail", name: "Bicycle", author: "longtail", uid: "25aa85eeba944baea33ce5cde985ca49" },
  { id: "monopatin-xiaomi", file: "monopatin_xiaomi", name: "Xiaomi Electric Scooter 4", author: "mmaarriioo", uid: "e53ebaf78add4735887023db3a105d1c" },
  { id: "honda-cb750", file: "moto_cb750", name: "Honda CB 750 F Super Sport 1970", author: "Alex.Ka.", uid: "f121301624174b179ca4d50158797b03", simplify: 0.5 },
  { id: "moto-si", file: "moto_si", name: "Moto SI", author: "KidBi-Gaming", uid: "80474ebbf5cc4538b21388ca11e4ab24", simplify: 0.4 },
  { id: "yamaha-xmax", file: "moto_xmax", name: "Yamaha XMAX – Low Poly / Game Ready", author: "KidBi-Gaming", uid: "b91a844ea42740f8a298574975806445", simplify: 0.4 },
  { id: "suzuki-skywave", file: "skywave", name: "Suzuki Skywave", author: "sassuscus", uid: "e1bcfc1ee51b4aab8417b00ab90f89fc", simplify: 0.25 },
  { id: "vespa", file: "vespa", name: "Vespa Super Sport 180", author: "VforValensa", uid: "74dfd9925fde4ae5882eb74c77c3c663" },
];

function optimize(input, output, { simplify, error = 0.005 }) {
  mkdirSync(join(output, ".."), { recursive: true });
  const args = [
    ...GLTF_TRANSFORM,
    "optimize",
    input,
    output,
    "--compress",
    "meshopt",
    "--texture-compress",
    "webp",
    "--texture-size",
    "512",
    "--instance",
    "false",
  ];
  // Error 0,5 %: baja triángulos sin deformar la carrocería.
  if (simplify) args.push("--simplify-ratio", String(simplify), "--simplify-error", String(error));
  else args.push("--simplify", "false");
  execFileSync("npx", args, { stdio: "inherit" });
}

/** Escribe (o reemplaza) una sección de CREDITOS.md. */
function writeCredits(header, dir, list) {
  const path = join(OUT, "CREDITOS.md");
  const current = readFileSync(path, "utf8");
  const section = `${header}
${list.map((c) => `- \`models/${dir}/${c.id}.glb\` — "${c.name}" de ${c.author}, https://sketchfab.com/3d-models/${c.uid}`).join("\n")}
  Optimizados (geometría y texturas reducidas) con \`node scripts/camofduty/optimize-street-cars.mjs\`.

`;
  const start = current.indexOf(header);
  const next = start < 0 ? -1 : current.indexOf("\n## ", start + header.length);
  const updated =
    start < 0
      ? current.replace("\n## Microsoft Rocketbox", `\n${section}\n## Microsoft Rocketbox`)
      : current.slice(0, start) + section + (next < 0 ? "" : current.slice(next + 1));
  writeFileSync(path, updated);
}

function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Falta la carpeta con los cod-car-<id>.glb / cod-<id>.glb");
  const groups = [
    { list: CARS, out: "cars", input: (c) => `cod-car-${c.id}.glb`, header: "## Autos — Sketchfab (CC BY 4.0)" },
    { list: RIDES, out: "rides", input: (c) => `cod-${c.file}.glb`, header: "## Bicis, monopatines y motos — Sketchfab (CC BY 4.0)" },
  ];
  for (const g of groups) {
    let found = 0;
    for (const item of g.list) {
      const input = join(dir, g.input(item));
      if (!existsSync(input)) continue;
      found += 1;
      console.log(`→ ${item.name}`);
      optimize(input, join(OUT, "models", g.out, `${item.id}.glb`), item);
    }
    // Sólo se reescriben los créditos del grupo que se procesó.
    if (found) writeCredits(g.header, g.out, g.list);
  }
}

main();
