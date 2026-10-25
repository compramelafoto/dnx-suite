/**
 * Progreso del curso: resumen por nivel, medallas y validación de las tomas
 * que llegan del simulador (el servidor vuelve a corregir: no se confía en la
 * nota que manda el navegador).
 */

import { LESSONS, lessonsOfLevel } from "./lessons";
import type { CourseLevel, Shot, StreetShot, StudioShot } from "./types";

export interface LessonProgress {
  lessonId: string;
  stars: number;
  attempts: number;
  passedAt: string | null;
}

export type Medal = "ninguna" | "bronce" | "plata" | "oro";

export interface LevelSummary {
  level: CourseLevel;
  total: number;
  passed: number;
  stars: number;
  maxStars: number;
  /** Bronce: todas aprobadas; plata: todas con 2 estrellas o más; oro: todas con 3. */
  medal: Medal;
  complete: boolean;
}

export function summarizeLevel(level: CourseLevel, progress: readonly LessonProgress[]): LevelSummary {
  const lessons = lessonsOfLevel(level);
  const byId = new Map(progress.map((p) => [p.lessonId, p]));
  const stars = lessons.map((l) => byId.get(l.id)?.stars ?? 0);
  const passed = stars.filter((s) => s > 0).length;
  const complete = passed === lessons.length;
  const medal: Medal = !complete ? "ninguna" : stars.every((s) => s >= 3) ? "oro" : stars.every((s) => s >= 2) ? "plata" : "bronce";
  return { level, total: lessons.length, passed, stars: stars.reduce((a, b) => a + b, 0), maxStars: lessons.length * 3, medal, complete };
}

/** Una lección se habilita cuando la anterior del mismo nivel está aprobada (la primera, siempre). */
export function isUnlocked(lessonId: string, progress: readonly LessonProgress[]): boolean {
  const lesson = LESSONS.find((l) => l.id === lessonId);
  if (!lesson || lesson.number === 1) return Boolean(lesson);
  const prev = lessonsOfLevel(lesson.level).find((l) => l.number === lesson.number - 1);
  return Boolean(prev && progress.some((p) => p.lessonId === prev.id && p.stars > 0));
}

const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);

/** Toma recibida del navegador, limpia y con valores seguros (null si no tiene forma de toma). */
export function parseShot(raw: unknown): Shot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.sim === "calle") {
    const subject = (r.subject ?? {}) as Record<string, unknown>;
    const shot: StreetShot = {
      sim: "calle",
      iso: num(r.iso, 100),
      shutterSeconds: Math.max(1 / 16000, num(r.shutterSeconds, 1 / 125)),
      aperture: num(r.aperture, 8),
      focalLengthMm: num(r.focalLengthMm, 50),
      whiteBalance: num(r.whiteBalance, 5600),
      mode: oneOf(r.mode, ["M", "A", "S"] as const, "M"),
      exposureCompensation: num(r.exposureCompensation),
      exposureError: num(r.exposureError, 99),
      metering: oneOf(r.metering, ["MATRIX", "CENTER", "SPOT"] as const, "MATRIX"),
      focusMode: typeof r.focusMode === "string" ? r.focusMode.slice(0, 8) : "AF-S",
      focusDistanceM: num(r.focusDistanceM, 6),
      subject: {
        kind: oneOf(subject.kind, ["persona", "corredor", "auto", "bici", "moto", "ninguno"] as const, "ninguno"),
        distanceM: numOrNull(subject.distanceM),
        speedMps: num(subject.speedMps),
        frameX: numOrNull(subject.frameX),
        frameY: numOrNull(subject.frameY),
      },
      panningMatch: numOrNull(r.panningMatch),
      timeOfDayMinutes: num(r.timeOfDayMinutes, 720),
      sunElevationDeg: num(r.sunElevationDeg, 45),
      weather: oneOf(r.weather, ["sunny", "cloudy", "rain"] as const, "sunny"),
      cameraHeightM: num(r.cameraHeightM, 1.7),
      rollDeg: num(r.rollDeg),
      puddleDistanceM: numOrNull(r.puddleDistanceM),
    };
    return shot;
  }
  if (r.sim === "estudio") {
    const shot: StudioShot = {
      sim: "estudio",
      iso: num(r.iso, 100),
      shutterSeconds: Math.max(1 / 16000, num(r.shutterSeconds, 1 / 125)),
      aperture: num(r.aperture, 8),
      focalLengthMm: num(r.focalLengthMm, 85),
      whiteBalance: num(r.whiteBalance, 5500),
      exposureError: num(r.exposureError, 99),
      pattern: oneOf(r.pattern, ["none", "butterfly", "loop", "rembrandt", "split", "rim", "underlight", "top", "flat"] as const, "none"),
      ratio: numOrNull(r.ratio),
      side: r.side === "broad" || r.side === "short" ? r.side : null,
      backgroundEv: numOrNull(r.backgroundEv),
      overSync: r.overSync === true,
      lightsOn: Math.max(0, Math.round(num(r.lightsOn))),
      keyModifier: typeof r.keyModifier === "string" ? r.keyModifier.slice(0, 40) : null,
      hasHairLight: r.hasHairLight === true,
      hasBackgroundLight: r.hasBackgroundLight === true,
      subjectYaw: num(r.subjectYaw),
    };
    return shot;
  }
  return null;
}
