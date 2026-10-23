/**
 * Serializa un set de luces en un texto corto para compartirlo por enlace
 * (`/camofduty/estudio#s=...`) o guardarlo en una ranura de captura.
 */

import { MODIFIERS } from "./modifiers";
import { MAX_LIGHTS, initialStudioState, makeLight } from "./presets";
import type { BackdropId, LightAim, ModifierId, StudioState, SubjectId } from "./types";

const VERSION = 1;

const r2 = (n: number) => Math.round(n * 100) / 100;

const BACKDROPS: BackdropId[] = ["white", "grey", "black", "blue", "green", "warm"];
const SUBJECTS: SubjectId[] = ["skin-light", "skin-medium", "skin-dark", "plaster"];
const AIMS: LightAim[] = ["subject", "hair", "background"];

export function serializeStudio(state: StudioState): string {
  const payload = {
    v: VERSION,
    c: [r2(state.camera.x), r2(state.camera.y), r2(state.camera.z), state.camera.focalMm, state.camera.aperture, state.camera.shutter, state.camera.iso, state.camera.whiteBalance],
    s: state.subject,
    y: Math.round(state.subjectYaw),
    b: state.backdrop,
    r: state.roomLux,
    l: state.lights.map((l) => [l.name, l.on ? 1 : 0, l.modifier, r2(l.x), r2(l.y), r2(l.z), l.aim, r2(l.powerStops), l.gel, l.kelvin]),
  };
  const json = JSON.stringify(payload);
  const b64 = typeof window === "undefined" ? Buffer.from(json, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

/** Devuelve null si el texto no es un set válido. Nunca lanza. */
export function deserializeStudio(text: string): StudioState | null {
  try {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof window === "undefined"
        ? Buffer.from(b64, "base64").toString("utf8")
        : decodeURIComponent(escape(atob(b64)));
    const p = JSON.parse(json);
    if (!p || p.v !== VERSION || !Array.isArray(p.l)) return null;
    const base = initialStudioState();
    const c = Array.isArray(p.c) ? p.c : [];
    const lights = (p.l as unknown[][]).slice(0, MAX_LIGHTS).flatMap((raw, i) => {
      const modifier = raw[2] as ModifierId;
      if (!(modifier in MODIFIERS)) return [];
      return [
        makeLight(i, {
          name: typeof raw[0] === "string" ? raw[0].slice(0, 24) : undefined,
          on: raw[1] === 1,
          modifier,
          x: num(raw[3], 1, -6, 6),
          y: num(raw[4], 2, 0.2, 4),
          z: num(raw[5], 1, -2.4, 6),
          aim: AIMS.includes(raw[6] as LightAim) ? (raw[6] as LightAim) : "subject",
          powerStops: num(raw[7], 3, 0, 7),
          gel: typeof raw[8] === "string" ? raw[8] : "none",
          kelvin: num(raw[9], 5600, 2700, 7500),
        }),
      ];
    });
    return {
      ...base,
      lights,
      selectedId: lights[0]?.id ?? null,
      camera: {
        x: num(c[0], base.camera.x, -6, 6),
        y: num(c[1], base.camera.y, 0.3, 3.5),
        z: num(c[2], base.camera.z, 0.6, 7),
        focalMm: num(c[3], base.camera.focalMm, 16, 200),
        aperture: num(c[4], base.camera.aperture, 1.4, 22),
        shutter: num(c[5], base.camera.shutter, 1 / 8000, 1),
        iso: num(c[6], base.camera.iso, 50, 12800),
        whiteBalance: num(c[7], base.camera.whiteBalance, 2500, 9000),
      },
      subject: SUBJECTS.includes(p.s) ? p.s : base.subject,
      subjectYaw: num(p.y, 0, -90, 90),
      backdrop: BACKDROPS.includes(p.b) ? p.b : base.backdrop,
      roomLux: num(p.r, base.roomLux, 0, 2000),
    };
  } catch {
    return null;
  }
}
