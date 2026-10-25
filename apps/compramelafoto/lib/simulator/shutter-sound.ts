/**
 * Sonido de obturador DSLR — Cam Of Duty.
 *
 * Grabación real (CC0, ver public/camofduty/audio/CREDITOS.md) en dos partes:
 * el espejo que sube con la primera cortinilla y la segunda cortinilla con el
 * espejo que baja. Entre las dos pasa el tiempo de exposición, como en una
 * cámara de verdad (en 1" se oyen los dos golpes separados por un segundo).
 * Mientras la grabación no cargó, suena la versión sintética.
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

const SAMPLE_URLS = { open: "/camofduty/audio/shutter-open.wav", close: "/camofduty/audio/shutter-close.wav" } as const;
/** Entre el arranque de una parte y la otra en tomas rápidas (espejo y cortinillas). */
const SAMPLE_MIN_GAP_SEC = 0.09;

let samples: { open: AudioBuffer; close: AudioBuffer } | null = null;
let loading: Promise<void> | null = null;

/** Baja y decodifica la grabación una sola vez (después del primer gesto, cuando hay audio). */
export function preloadShutterSamples(): Promise<void> {
  const ctx = getSimulatorAudioContext();
  if (!ctx || samples) return Promise.resolve();
  loading ??= (async () => {
    const decode = async (url: string) => ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const [open, close] = await Promise.all([decode(SAMPLE_URLS.open), decode(SAMPLE_URLS.close)]);
    samples = { open, close };
  })().catch(() => {
    loading = null;
  });
  return loading;
}

function playBuffer(ctx: AudioContext, dest: AudioNode, buffer: AudioBuffer, at: number, gain: number) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  // Cada toma suena apenas distinta, como en la realidad.
  src.playbackRate.value = 0.98 + Math.random() * 0.04;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(dest);
  src.start(at);
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
    if (samples) {
      playBuffer(ctx, dest, samples.open, now + 0.005, 1.4);
      playBuffer(ctx, dest, samples.close, now + 0.005 + Math.max(SAMPLE_MIN_GAP_SEC, exposureSec + 0.06), 1.3);
      return;
    }
    void preloadShutterSamples();
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
