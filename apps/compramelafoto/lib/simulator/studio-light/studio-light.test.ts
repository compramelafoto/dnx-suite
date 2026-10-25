import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SUBJECT_HEAD,
  classifyPattern,
  formatFNumber,
  lightN2AtSubject,
  meter,
  renderedLightColor,
  subjectHead,
} from "./metering";
import { PRESETS, applyPreset, initialStudioState, makeLight, polarToXZ } from "./presets";
import { ANIMATIONS, animationUrl, decodeClip, stripRootMotion } from "./animation-clip";
import { boomOffset } from "./boom";
import { computeCavityAO } from "./cavity-ao";
import { FIGURES } from "./figures";
import { BASE_HEAD, POSES, POSE_GROUPS, SEQUENCES, armDirections, legDirections, poseById, sampleSequence } from "./poses";
import { deserializeStudio, serializeStudio } from "./share";
import type { StudioState } from "./types";

function oneLight(dist: number, extra: Partial<StudioState["lights"][number]> = {}): StudioState {
  const base = initialStudioState();
  const { x, z } = polarToXZ(30, dist);
  const light = makeLight(0, { modifier: "bare", x, y: SUBJECT_HEAD[1], z, powerStops: 0, ...extra });
  return { ...base, roomLux: 0, lights: [light], selectedId: light.id };
}

test("ley de la inversa del cuadrado: el doble de distancia pierde 2 pasos", () => {
  const near = oneLight(1);
  const far = oneLight(2);
  const evNear = meter(near).readings[0].ev;
  const evFar = meter(far).readings[0].ev;
  assert.ok(Math.abs(evNear - evFar - 2) < 0.02, `${evNear} vs ${evFar}`);
});

test("un reflector estándar a plena potencia y 1 m da su número guía", () => {
  const s = oneLight(1);
  const reading = meter(s).readings[0];
  assert.ok(Math.abs(reading.fNumber - 45) < 0.5, String(reading.fNumber));
});

test("el flash no depende del obturador; la luz continua sí", () => {
  const flash = oneLight(1.5);
  const flashSlow = { ...flash, camera: { ...flash.camera, shutter: 1 / 30 } };
  assert.equal(lightN2AtSubject(flash.lights[0], flash), lightN2AtSubject(flashSlow.lights[0], flashSlow));

  const led = oneLight(1.5, { modifier: "led-panel" });
  const ledSlow = { ...led, camera: { ...led.camera, shutter: 1 / 30 } };
  const gain = lightN2AtSubject(ledSlow.lights[0], ledSlow) / lightN2AtSubject(led.lights[0], led);
  assert.ok(Math.abs(gain - 125 / 30) < 0.01, String(gain));
});

test("los esquemas ajustan la luz principal a la exposición de la cámara (TTL)", () => {
  for (const preset of PRESETS) {
    const s = applyPreset(preset, initialStudioState());
    const key = s.lights[0];
    const ev = meter({ ...s, lights: [key], roomLux: 0 }).readings[0].ev;
    assert.ok(Math.abs(ev) <= 0.35, `${preset.id}: ${ev}`);
  }
});

test("cada esquema se reconoce como su patrón", () => {
  const expected: Record<string, string> = {
    loop: "loop",
    rembrandt: "rembrandt",
    butterfly: "butterfly",
    split: "split",
    cenital: "top",
  };
  for (const [id, pattern] of Object.entries(expected)) {
    const s = applyPreset(PRESETS.find((p) => p.id === id)!, initialStudioState());
    assert.equal(classifyPattern(s.lights[0], s.subjectYaw), pattern, id);
  }
});

test("iluminación corta y ancha", () => {
  const short = applyPreset(PRESETS.find((p) => p.id === "short")!, initialStudioState());
  const broad = applyPreset(PRESETS.find((p) => p.id === "broad")!, initialStudioState());
  assert.equal(meter(short).side, "short");
  assert.equal(meter(broad).side, "broad");
});

test("el reflector rebota luz sólo si alguna luz le pega", () => {
  const s = applyPreset(PRESETS.find((p) => p.id === "rembrandt")!, initialStudioState());
  const reflector = s.lights[1];
  assert.ok(lightN2AtSubject(reflector, s) > 0);
  const dark = { ...s, lights: s.lights.map((l, i) => (i === 0 ? { ...l, on: false } : l)) };
  assert.equal(lightN2AtSubject(reflector, dark), 0);
});

test("sobre la sincronización avisa la franja negra", () => {
  const s = oneLight(1);
  assert.equal(meter(s).overSync, false);
  const fast = { ...s, camera: { ...s.camera, shutter: 1 / 1000 } };
  const report = meter(fast);
  assert.equal(report.overSync, true);
  assert.ok(report.syncBand > 0.7);
});

test("relación de luces del esquema de tres puntos ronda 3:1 o 4:1", () => {
  const s = applyPreset(PRESETS.find((p) => p.id === "three-point")!, initialStudioState());
  const { ratio } = meter({ ...s, roomLux: 0 });
  assert.ok(ratio !== null && ratio > 2.5 && ratio < 5, String(ratio));
});

test("el enlace compartido devuelve el mismo set", () => {
  const s = applyPreset(PRESETS.find((p) => p.id === "cinema")!, initialStudioState());
  const back = deserializeStudio(serializeStudio(s));
  assert.ok(back);
  assert.equal(back.lights.length, s.lights.length);
  assert.equal(back.lights[0].gel, "cto");
  assert.equal(back.backdrop, s.backdrop);
  assert.ok(Math.abs(back.lights[1].x - s.lights[1].x) < 0.01);
  assert.equal(deserializeStudio("basura!!"), null);
});

test("balance de blancos: flash a 5500 K se ve neutro, CTO se ve cálido", () => {
  const s = oneLight(1);
  const neutral = renderedLightColor(s.lights[0], 5500);
  assert.ok(Math.abs(neutral[0] - neutral[2]) < 0.03, neutral.join());
  const warm = renderedLightColor({ ...s.lights[0], gel: "cto" }, 5500);
  assert.ok(warm[0] > warm[2] * 1.4, warm.join());
  const corrected = renderedLightColor({ ...s.lights[0], modifier: "fresnel" }, 3200);
  assert.ok(Math.abs(corrected[0] - corrected[2]) < 0.05, corrected.join());
});

test("lectura de fotómetro", () => {
  assert.equal(formatFNumber(8), "f/8");
  assert.equal(formatFNumber(8 * Math.pow(2, 0.15)), "f/8 +3");
  assert.equal(formatFNumber(0), "—");
});

test("poses: los ángulos del brazo dan la dirección esperada", () => {
  const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const side = armDirections({ raise: 90, forward: 0, elbow: 0, roll: 0 }, 1);
  assert.ok(close(side.upper, [1, 0, 0]), side.upper.join());
  assert.ok(close(side.fore, side.upper), "codo estirado");
  const front = armDirections({ raise: 0, forward: 90, elbow: 0, roll: 0 }, -1);
  assert.ok(close(front.upper, [0, 0, 1]), front.upper.join());
  // Brazo derecho al costado (−X) con codo a 90° y roll −90: el antebrazo apunta arriba (saludo).
  const wave = armDirections({ raise: 90, forward: 0, elbow: 90, roll: -90 }, -1);
  assert.ok(wave.fore[1] > 0.99, wave.fore.join());
  // Brazos cruzados: el antebrazo izquierdo cruza hacia la derecha del cuerpo.
  const crossed = armDirections(POSES.find((p) => p.id === "arms-crossed")!.params.left, 1);
  assert.ok(crossed.fore[0] < -0.5, crossed.fore.join());
});

test("modelos de cuerpo entero: catálogo completo y enlace con pose a mano", () => {
  assert.ok(FIGURES.length >= 10);
  assert.ok(FIGURES.some((f) => f.gender === "mujer") && FIGURES.some((f) => f.gender === "hombre"));
  assert.equal(new Set(FIGURES.map((f) => f.id)).size, FIGURES.length);
  const base = initialStudioState();
  const s: StudioState = {
    ...base,
    subject: "laura",
    pose: "custom",
    poseParams: { ...base.poseParams, headTurn: 25, left: { raise: 40, forward: 10, elbow: 90, roll: 60 } },
    camera: { ...base.camera, aimY: 0.92 },
  };
  const back = deserializeStudio(serializeStudio(s));
  assert.ok(back);
  assert.equal(back.subject, "laura");
  assert.equal(back.pose, "custom");
  assert.equal(back.poseParams.headTurn, 25);
  assert.equal(back.poseParams.left.elbow, 90);
  assert.equal(back.camera.aimY, 0.92);
  const unknown = deserializeStudio(serializeStudio({ ...s, subject: "no-existe" }));
  assert.equal(unknown?.subject, base.subject);
});

test("oclusión de cavidades: un hueco se oscurece y una superficie plana no", () => {
  // Plano de 21×21 puntos con un pozo en el centro (como una fosa nasal).
  const pos: number[] = [];
  const nor: number[] = [];
  for (let i = -10; i <= 10; i++) {
    for (let j = -10; j <= 10; j++) {
      const r = Math.hypot(i, j);
      pos.push(i * 0.1, r < 3 ? -0.6 + r * 0.15 : 0, j * 0.1);
      nor.push(0, 1, 0);
    }
  }
  const ao = computeCavityAO(pos, nor, { radius: 0.5 });
  const center = ao[10 * 21 + 10];
  const flat = ao[0];
  assert.ok(flat > 0.97, `plano ${flat}`);
  assert.ok(center < 0.6, `pozo ${center}`);
});

test("luz cenital: cuelga de una jirafa con el pie fuera del sujeto", () => {
  const s = applyPreset(PRESETS.find((p) => p.id === "cenital")!, initialStudioState());
  const top = s.lights[0];
  const boom = boomOffset(top);
  assert.ok(boom, "la cenital usa jirafa");
  // El pie queda a más de un metro del eje del sujeto.
  assert.ok(Math.hypot(top.x + boom.x, top.z + boom.z) > 1);
  // Una luz lateral común no usa jirafa.
  assert.equal(boomOffset({ ...top, x: 1.5, z: 0.5, y: 2 }), null);
});

test("animaciones: los 18 clips existen y se decodifican con cuaterniones válidos", () => {
  for (const anim of ANIMATIONS) {
    for (const gender of ["mujer", "hombre"] as const) {
      const file = `public${animationUrl(anim, gender)}`;
      const clip = decodeClip(JSON.parse(readFileSync(file, "utf8")));
      assert.ok(clip.duration > 1, `${file} dura ${clip.duration}`);
      const pelvis = clip.tracks.find((t) => t.name === "Bip01_Pelvis.quaternion");
      assert.ok(pelvis, `${file} sin pelvis`);
      const [x, y, z, w] = pelvis.values.slice(0, 4);
      assert.ok(Math.abs(Math.hypot(x, y, z, w) - 1) < 1e-6);
      const root = clip.tracks.find((t) => t.name === "Bip01.position");
      // La raíz queda cerca del piso (en centímetros del FBX): no se recortó.
      assert.ok(root && Math.abs(root.values[1]) < 3000, `${file} raíz ${root?.values[1]}`);
    }
  }
});

test("piernas: muslo adelante y rodilla doblada dan la postura de sentado", () => {
  const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const seated = legDirections({ forward: 90, out: 0, knee: 90, roll: 0 }, 1);
  assert.ok(close(seated.thigh, [0, 0, 1]), seated.thigh.join());
  assert.ok(close(seated.calf, [0, -1, 0]), seated.calf.join());
  const standing = legDirections({ forward: 0, out: 0, knee: 90, roll: 0 }, -1);
  assert.ok(close(standing.calf, [0, 0, -1]), "de pie la rodilla dobla hacia atrás");
});

test("catálogo de poses: todos los grupos tienen poses y apoyos conocidos", () => {
  for (const g of POSE_GROUPS) assert.ok(POSES.some((p) => p.group === g), g);
  assert.equal(new Set(POSES.map((p) => p.id)).size, POSES.length);
  for (const p of POSES) assert.ok(p.params.base in BASE_HEAD, p.id);
  // Sentada la cara baja: el fotómetro y las luces apuntan más abajo.
  const s = { ...initialStudioState(), subject: "sofia", poseParams: poseById("stool-upright") };
  assert.ok(subjectHead(s)[1] < 1.5);
});

test("coreografías: el salto despega del piso y vuelve", () => {
  const jump = SEQUENCES.find((q) => q.id === "seq-jump")!;
  assert.equal(sampleSequence(jump, 0).lift, 0);
  const peak = Math.max(...Array.from({ length: 50 }, (_, i) => sampleSequence(jump, i * 0.05).lift));
  assert.ok(peak > 0.4, String(peak));
  const spin = SEQUENCES.find((q) => q.id === "seq-pirouette")!;
  assert.ok(sampleSequence(spin, 1.3).spin > 300);
});

test("enlace: una pose a mano con piernas y apoyo vuelve igual", () => {
  const base = initialStudioState();
  const custom = { ...poseById("stool-crossed"), headTurn: 12 };
  const back = deserializeStudio(serializeStudio({ ...base, subject: "laura", pose: "custom", poseParams: custom }));
  assert.equal(back?.poseParams.base, "stool");
  assert.equal(back?.poseParams.legs?.right.forward, 104);
  assert.equal(back?.poseParams.headTurn, 12);
});

test("caminatas: la raíz no avanza, así el cuerpo no vuelve al inicio en cada ciclo", () => {
  for (const file of ["f_walk_neutral_01", "m_walk_fast_01", "m_walk_stroll_01"]) {
    const raw = decodeClip(JSON.parse(readFileSync(`public/camofduty/models/animations/${file}.json`, "utf8")));
    const before = raw.tracks.find((t) => t.name === "Bip01.position")!.values;
    const span = (v: ArrayLike<number>, k: number) => {
      let lo = Infinity, hi = -Infinity;
      for (let i = k; i < v.length; i += 3) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
      return hi - lo;
    };
    assert.ok(span(before, 2) > 90, `${file} ya venía sin avance`);
    const v = stripRootMotion(raw).tracks.find((t) => t.name === "Bip01.position")!.values;
    assert.equal(span(v, 0), 0);
    assert.equal(span(v, 2), 0);
    assert.ok(span(v, 1) > 1, `${file} perdió el sube y baja de la cadera`);
  }
});
