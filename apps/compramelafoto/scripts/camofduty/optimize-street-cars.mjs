#!/usr/bin/env node
/**
 * Optimiza los autos de la Calle 3D de Cam Of Duty.
 *
 * Fuente: Sketchfab (CC BY 4.0, requiere atribución). Sketchfab sólo deja
 * bajar con sesión iniciada, así que los .glb se bajan a mano (versión
 * "glb" más liviana de cada página) con el nombre `cod-car-<id>.glb`.
 *
 * Uso (desde apps/compramelafoto):
 *   node scripts/camofduty/optimize-street-cars.mjs <carpeta-con-los-glb>
 *
 * Salida: public/camofduty/street/models/cars/<id>.glb (geometría meshopt,
 * texturas WebP de 512 px) y la sección de autos de CREDITOS.md. La escala y
 * la orientación de cada modelo se corrigen en lib/simulator/street/street-cars.ts.
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

function optimize(input, output, { simplify, error = 0.005 }) {
  mkdirSync(join(OUT, "models/cars"), { recursive: true });
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

const CREDITS_HEADER = "## Autos — Sketchfab (CC BY 4.0)";

function writeCredits() {
  const path = join(OUT, "CREDITOS.md");
  const current = readFileSync(path, "utf8");
  const section = `${CREDITS_HEADER}
${CARS.map((c) => `- \`models/cars/${c.id}.glb\` — "${c.name}" de ${c.author}, https://sketchfab.com/3d-models/${c.uid}`).join("\n")}
  Optimizados (geometría y texturas reducidas) con \`node scripts/camofduty/optimize-street-cars.mjs\`.

`;
  const start = current.indexOf(CREDITS_HEADER);
  const next = start < 0 ? -1 : current.indexOf("\n## ", start + CREDITS_HEADER.length);
  const updated =
    start < 0
      ? current.replace("\n## Microsoft Rocketbox", `\n${section}\n## Microsoft Rocketbox`)
      : current.slice(0, start) + section + (next < 0 ? "" : current.slice(next + 1));
  writeFileSync(path, updated);
}

function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Falta la carpeta con los cod-car-<id>.glb");
  for (const car of CARS) {
    const input = join(dir, `cod-car-${car.id}.glb`);
    if (!existsSync(input)) {
      console.warn(`Falta ${input}`);
      continue;
    }
    console.log(`→ ${car.name}`);
    optimize(input, join(OUT, "models/cars", `${car.id}.glb`), car);
  }
  writeCredits();
}

main();
