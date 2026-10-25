/**
 * Convierte animaciones FBX de Microsoft Rocketbox (MIT) a clips JSON compactos
 * para el Estudio de luz de Cam Of Duty.
 *
 * Uso:
 *   pnpm --filter compramelafoto exec tsx scripts/camofduty/convert-rocketbox-animations.ts <carpeta-con-fbx>
 *
 * Se queda con los huesos del cuerpo y las dos primeras falanges (sin gestos
 * faciales), recorta a 12 s, remuestrea a 15 cuadros por segundo y guarda los
 * valores cuantizados en 16 bits (base64): de ~3 MB a ~80 KB por clip.
 * El formato lo lee lib/simulator/studio-light/animation-clip.ts.
 * Salida: public/camofduty/models/animations/<nombre>.json
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const OUT_DIR = join(process.cwd(), "public/camofduty/models/animations");
const FPS = 15;
const MAX_SECONDS = 12;

/** Huesos que se animan: cuerpo y dedos. La cara queda quieta (la usa el parpadeo). */
const BODY = /^Bip01(_(Pelvis|Spine\d?|Neck|Head|[LR]_(Clavicle|UpperArm|Forearm|Hand|Finger[0-4]1?|Thigh|Calf|Foot|Toe0)))?$/;

function encode(values: number[], scale: number): string {
  const ints = new Int16Array(values.map((v) => Math.max(-32767, Math.min(32767, Math.round(v * scale)))));
  return Buffer.from(ints.buffer).toString("base64");
}

function convert(file: string): { name: string; bytes: number; tracks: number; duration: number } {
  const buffer = readFileSync(file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const group = new FBXLoader().parse(arrayBuffer, "");
  const clip = group.animations[0];
  if (!clip) throw new Error(`Sin animación: ${file}`);

  const duration = Math.min(clip.duration, MAX_SECONDS);
  const frames = Math.max(2, Math.round(duration * FPS) + 1);
  const tracks: { b: string; k: "q" | "p"; d: string }[] = [];
  for (const t of clip.tracks) {
    const [bone, prop] = t.name.split(".");
    if (!BODY.test(bone)) continue;
    const isQuat = prop === "quaternion";
    // Posición sólo de la raíz y la pelvis: el resto de los huesos no se estira.
    if (!isQuat && !(prop === "position" && (bone === "Bip01" || bone === "Bip01_Pelvis"))) continue;
    const interpolant = t.createInterpolant();
    const values: number[] = [];
    for (let i = 0; i < frames; i++) values.push(...interpolant.evaluate(Math.min(duration, i / FPS)));
    // Cuaterniones en [-1, 1] → ×32767; posiciones (cm del FBX) → décimas de cm.
    tracks.push({ b: bone, k: isQuat ? "q" : "p", d: encode(values, isQuat ? 32767 : 10) });
  }

  const name = basename(file).replace(/\.max\.fbx$/i, "");
  const json = JSON.stringify({ v: 1, name, fps: FPS, frames, tracks });
  writeFileSync(join(OUT_DIR, `${name}.json`), json);
  return { name, bytes: json.length, tracks: tracks.length, duration };
}

const dir = process.argv[2];
if (!dir) {
  console.error("Indicá la carpeta con los FBX.");
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
for (const f of readdirSync(dir).filter((x) => x.toLowerCase().endsWith(".fbx")).sort()) {
  const r = convert(join(dir, f));
  console.log(`${r.name}: ${r.tracks} pistas, ${r.duration.toFixed(1)} s, ${(r.bytes / 1024).toFixed(0)} KB`);
}
