/**
 * Sonido sintético de obturador DSLR — Cam Of Duty.
 * Web Audio API — sin archivos externos.
 */

import { shutterSpeedToSeconds } from "./camera-math";
import {
  applyExpEnvelope,
  createNoiseBuffer,
  getSimulatorAudioContext,
  getSimulatorMasterGain,
  resumeSimulatorAudio,
} from "./sound-engine";

export const COD_OBTURAR_EVENT = "cod-obturar";

export interface CodObturarDetail {
  durationMs: number;
}

/** Mínimo entre apertura y cierre en obturaciones muy rápidas. */
const MIN_OPEN_SEC = 0.032;

/** Retardo espejo → cortinilla (DSLR típica). */
const MIRROR_TO_CURTAIN_SEC = 0.018;

function playNoiseBurst(
  ctx: AudioContext,
  dest: AudioNode,
  startAt: number,
  duration: number,
  peak: number,
  filterHz: number,
  q = 0.9,
): void {
  const buffer = createNoiseBuffer(ctx, duration);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const env = Math.pow(1 - i / data.length, 1.8);
    data[i] *= env;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterHz;
  filter.Q.value = q;

  const gain = ctx.createGain();
  applyExpEnvelope(gain, startAt, 0.0015, peak, duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  source.start(startAt);
  source.stop(startAt + duration + 0.02);
}

function playBodyThump(
  ctx: AudioContext,
  dest: AudioNode,
  startAt: number,
  peak: number,
  baseHz: number,
  decay = 0.055,
): void {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(baseHz, startAt);
  osc.frequency.exponentialRampToValueAtTime(Math.max(baseHz * 0.55, 28), startAt + decay);

  const gain = ctx.createGain();
  applyExpEnvelope(gain, startAt, 0.002, peak, decay);

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 220;

  osc.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(dest);
  osc.start(startAt);
  osc.stop(startAt + decay + 0.02);
}

function playMirrorSlap(ctx: AudioContext, dest: AudioNode, startAt: number): void {
  playBodyThump(ctx, dest, startAt, 0.42, 95, 0.07);
  playNoiseBurst(ctx, dest, startAt + 0.004, 0.038, 0.28, 1400, 1.1);
  playNoiseBurst(ctx, dest, startAt + 0.01, 0.022, 0.14, 4200, 1.4);
  playNoiseBurst(ctx, dest, startAt + 0.016, 0.018, 0.09, 6800, 0.8);
}

function playCurtainBlade(
  ctx: AudioContext,
  dest: AudioNode,
  startAt: number,
  kind: "open" | "close",
): void {
  const isClose = kind === "close";
  const thumpPeak = isClose ? 0.22 : 0.14;
  const thumpHz = isClose ? 78 : 88;

  playBodyThump(ctx, dest, startAt, thumpPeak, thumpHz, isClose ? 0.04 : 0.032);
  playNoiseBurst(
    ctx,
    dest,
    startAt + 0.001,
    0.026,
    isClose ? 0.34 : 0.24,
    isClose ? 1900 : 2400,
    1.2,
  );
  playNoiseBurst(
    ctx,
    dest,
    startAt + 0.006,
    0.02,
    isClose ? 0.2 : 0.15,
    isClose ? 5200 : 5800,
    1,
  );
  playNoiseBurst(ctx, dest, startAt + 0.012, 0.014, 0.08, 9000, 0.7);
}

/**
 * Ciclo DSLR: espejo → apertura cortinilla → espera → cierre cortinilla.
 * @param durationMs Tiempo de exposición efectivo (ms); en largas se perciben ambos clicks.
 */
export function playShutterSound(durationMs: number): void {
  const ctx = getSimulatorAudioContext();
  if (!ctx) return;

  void resumeSimulatorAudio().catch(() => {});

  try {
    const exposureSec = Math.max(durationMs / 1000, MIN_OPEN_SEC);
    const dest = getSimulatorMasterGain(ctx);
    const now = ctx.currentTime;
    const curtainOpenAt = now + MIRROR_TO_CURTAIN_SEC;
    const curtainCloseAt = curtainOpenAt + exposureSec;

    playMirrorSlap(ctx, dest, now);
    playCurtainBlade(ctx, dest, curtainOpenAt, "open");
    playCurtainBlade(ctx, dest, curtainCloseAt, "close");
  } catch {
    /* ignore */
  }
}

/**
 * Reproduce obturador a partir del preset de tiempo de exposición.
 */
export function playShutterCycle(shutterSpeed: string | number): void {
  const seconds =
    typeof shutterSpeed === "number" ? shutterSpeed : shutterSpeedToSeconds(shutterSpeed);
  playShutterSound(Math.max(seconds * 1000, MIN_OPEN_SEC * 1000));
}

export function shutterPresetToSeconds(shutterSpeed: string): number {
  return shutterSpeedToSeconds(shutterSpeed);
}
