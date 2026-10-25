import assert from "node:assert/strict";
import { test } from "node:test";
import { backgroundBlurPercent, gradeShot, insideDepthOfField } from "./grade";
import { LESSONS, lessonById, lessonsOfLevel, nextLesson } from "./lessons";
import { isUnlocked, parseShot, summarizeLevel } from "./progress";
import type { StreetShot, StudioShot } from "./types";

test("progreso: medallas por nivel y lecciones que se habilitan en orden", () => {
  const inicial = lessonsOfLevel("inicial");
  const all = (stars: number) => inicial.map((l) => ({ lessonId: l.id, stars, attempts: 1, passedAt: "2026-10-25T12:00:00Z" }));
  assert.equal(summarizeLevel("inicial", []).medal, "ninguna");
  assert.equal(summarizeLevel("inicial", all(1)).medal, "bronce");
  assert.equal(summarizeLevel("inicial", all(2)).medal, "plata");
  assert.equal(summarizeLevel("inicial", all(3)).medal, "oro");
  assert.ok(summarizeLevel("inicial", all(1)).complete);
  assert.ok(isUnlocked("exposicion", []));
  assert.ok(isUnlocked("modos-y-compensacion", []), "el avanzado se puede empezar directo");
  assert.ok(!isUnlocked("fotometro-histograma", []));
  assert.ok(isUnlocked("fotometro-histograma", [{ lessonId: "exposicion", stars: 1, attempts: 1, passedAt: null }]));
});

test("progreso: la toma que llega del navegador se limpia (sin valores raros)", () => {
  assert.equal(parseShot(null), null);
  assert.equal(parseShot({ sim: "otro" }), null);
  const s = parseShot({ sim: "calle", iso: "mil", mode: "Z", subject: { kind: "dragón" } });
  assert.ok(s && s.sim === "calle");
  if (s?.sim === "calle") {
    assert.equal(s.iso, 100);
    assert.equal(s.mode, "M");
    assert.equal(s.subject.kind, "ninguno");
    assert.equal(s.exposureError, 99, "sin exposición informada no aprueba");
  }
});

const street = (over: Partial<StreetShot> = {}): StreetShot => ({
  sim: "calle",
  iso: 100,
  shutterSeconds: 1 / 1000,
  aperture: 4,
  focalLengthMm: 50,
  whiteBalance: 5600,
  mode: "S",
  exposureCompensation: 0,
  exposureError: 0.1,
  metering: "MATRIX",
  focusMode: "AF-S",
  focusDistanceM: 6,
  subject: { kind: "corredor", distanceM: 6, speedMps: 3.5, frameX: 0.34, frameY: 0.5 },
  panningMatch: null,
  timeOfDayMinutes: 660,
  sunElevationDeg: 57,
  weather: "sunny",
  cameraHeightM: 1.7,
  rollDeg: 0,
  puddleDistanceM: null,
  ...over,
});

const studio = (over: Partial<StudioShot> = {}): StudioShot => ({
  sim: "estudio",
  iso: 100,
  shutterSeconds: 1 / 125,
  aperture: 8,
  focalLengthMm: 85,
  whiteBalance: 5500,
  exposureError: 0.1,
  pattern: "loop",
  ratio: 3,
  side: null,
  backgroundEv: -2,
  overSync: false,
  lightsOn: 2,
  keyModifier: "softbox-large",
  hasHairLight: false,
  hasBackgroundLight: false,
  subjectYaw: 0,
  ...over,
});

test("temario: diez lecciones por nivel, ids únicos y nunca \"velocidad\" para el obturador", () => {
  assert.equal(lessonsOfLevel("inicial").length, 10);
  assert.equal(lessonsOfLevel("avanzado").length, 10);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
  const text = JSON.stringify(LESSONS).toLowerCase();
  assert.ok(!/velocidad de (obturaci|exposici)/.test(text));
  for (const l of LESSONS) {
    assert.ok(l.criteria.some((c) => c.required), `${l.id} sin requisitos obligatorios`);
    assert.ok(l.explanation.length >= 2 && l.task.length > 20);
  }
  assert.equal(nextLesson("objetivos")?.id, "modos-y-compensacion");
  assert.equal(nextLesson("tres-luces"), null);
});

test("corrector: congelar al corredor aprueba con 1/1000 y falla con 1/60", () => {
  const lesson = lessonById("congelar-movimiento")!;
  const ok = gradeShot(lesson, street());
  assert.ok(ok.passed);
  assert.equal(ok.stars, 2); // tercios cumplido
  const slow = gradeShot(lesson, street({ shutterSeconds: 1 / 60 }));
  assert.ok(!slow.passed);
  const why = slow.results.filter((r) => !r.ok).map((r) => r.hint).join(" ");
  assert.match(why, /1\/60/);
});

test("corrector: la toma del estudio no sirve para una tarea de la calle", () => {
  const lesson = lessonById("congelar-movimiento")!;
  assert.ok(!gradeShot(lesson, studio()).passed);
});

test("corrector: Rembrandt en el estudio, con estrellas por contraste y exposición fina", () => {
  const lesson = lessonById("esquemas-retrato")!;
  const r = gradeShot(lesson, studio({ pattern: "rembrandt", ratio: 4, exposureError: 0.1 }));
  assert.ok(r.passed);
  assert.equal(r.stars, 3);
  assert.ok(!gradeShot(lesson, studio({ pattern: "loop" })).passed);
});

test("óptica: más desenfoque de fondo con diafragma abierto y foco cerca", () => {
  assert.ok(backgroundBlurPercent(85, 1.8, 3) > backgroundBlurPercent(85, 8, 3));
  assert.ok(backgroundBlurPercent(85, 2.8, 3) > backgroundBlurPercent(24, 2.8, 3));
  assert.ok(insideDepthOfField(50, 8, 5, 5.5));
  assert.ok(!insideDepthOfField(85, 1.8, 3, 6));
});
