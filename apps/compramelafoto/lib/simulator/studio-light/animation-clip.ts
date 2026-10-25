/**
 * Lector de las animaciones compactas del Estudio Fotográfico (ver
 * scripts/camofduty/convert-rocketbox-animations.ts): valores en 16 bits,
 * base64, a cuadros fijos por segundo.
 */

import * as THREE from "three";

export interface CompactClip {
  v: 1;
  name: string;
  fps: number;
  frames: number;
  tracks: { b: string; k: "q" | "p"; d: string }[];
}

export const ANIMATION_DIR = "/camofduty/models/animations";

export interface StudioAnimation {
  id: string;
  label: string;
  /** Nombre del archivo sin el prefijo de género (f_ / m_). */
  file: string;
}

export const ANIMATIONS: StudioAnimation[] = [
  { id: "breathe", label: "Respirar", file: "idle_breathe_01" },
  { id: "look", label: "Mirar alrededor", file: "idle_look_around_01" },
  { id: "talk", label: "Hablar", file: "gestic_talk_relaxed_01" },
  { id: "laugh", label: "Reírse", file: "gestic_laugh_low" },
  { id: "hair", label: "Tocarse el pelo", file: "idle_touch_hair_01" },
  { id: "wave", label: "Saludar", file: "wave_01" },
  { id: "clap", label: "Aplaudir", file: "claphands_01" },
  { id: "stretch", label: "Estirarse", file: "idle_stretch_arms_01" },
  { id: "cheer", label: "Festejar", file: "cheer_01" },
  { id: "dance", label: "Bailar", file: "dancing_cool" },
  { id: "dance-soft", label: "Bailar suave", file: "dancing_neutral" },
];

export function animationUrl(anim: StudioAnimation, gender: "mujer" | "hombre"): string {
  return `${ANIMATION_DIR}/${gender === "mujer" ? "f" : "m"}_${anim.file}.json`;
}

function decodeInt16(base64: string): Int16Array {
  const binary = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

/** Arma un AnimationClip de three.js a partir del formato compacto. */
export function decodeClip(data: CompactClip): THREE.AnimationClip {
  const times = Array.from({ length: data.frames }, (_, i) => i / data.fps);
  const tracks: THREE.KeyframeTrack[] = data.tracks.map((t) => {
    const ints = decodeInt16(t.d);
    if (t.k === "q") {
      const values = Array.from(ints, (v) => v / 32767);
      // La cuantización deja cuaterniones apenas fuera de norma: se normalizan.
      for (let i = 0; i < values.length; i += 4) {
        const l = Math.hypot(values[i], values[i + 1], values[i + 2], values[i + 3]) || 1;
        values[i] /= l;
        values[i + 1] /= l;
        values[i + 2] /= l;
        values[i + 3] /= l;
      }
      return new THREE.QuaternionKeyframeTrack(`${t.b}.quaternion`, times, values);
    }
    return new THREE.VectorKeyframeTrack(`${t.b}.position`, times, Array.from(ints, (v) => v / 10));
  });
  return new THREE.AnimationClip(data.name, times[times.length - 1], tracks);
}

/**
 * Deja la caminata "en el lugar": las de Rocketbox avanzan ~1,4 m por ciclo en
 * la raíz y, al repetirse, el cuerpo volvía de golpe al punto de partida. El
 * avance lo pone la escena; acá sólo queda el sube y baja de la cadera.
 */
export function stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const root = clip.tracks.find((t) => t.name === "Bip01.position");
  if (!root) return clip;
  const v = root.values;
  for (let i = 3; i < v.length; i += 3) {
    v[i] = v[0];
    v[i + 2] = v[2];
  }
  return clip;
}
