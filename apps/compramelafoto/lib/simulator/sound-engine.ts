/**
 * Motor de audio compartido — Cam Of Duty.
 * Web Audio API sin archivos externos. Un solo AudioContext global.
 */

let sharedContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let gestureBound = false;
let userGestureUnlocked = false;

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    sharedContext = ctx;
    masterGain = master;
    return ctx;
  } catch {
    return null;
  }
}

function bindGestureUnlock(): void {
  if (gestureBound || typeof window === "undefined") return;
  gestureBound = true;

  const unlock = () => {
    unlockSimulatorAudioFromGesture();
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

bindGestureUnlock();

export function unlockSimulatorAudioFromGesture(): void {
  userGestureUnlocked = true;
  if (!sharedContext) createContext();
  void resumeSimulatorAudio().catch(() => {});
}

/** Contexto global; null si el navegador bloquea audio o aún no hubo gesto del usuario. */
export function getSimulatorAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!userGestureUnlocked && !sharedContext) return null;
  if (!sharedContext) return createContext();
  return sharedContext;
}

export function getSimulatorMasterGain(ctx: AudioContext): GainNode {
  if (!masterGain || masterGain.context !== ctx) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

export async function resumeSimulatorAudio(): Promise<void> {
  const ctx = sharedContext;
  if (!ctx || ctx.state !== "suspended") return;
  try {
    await ctx.resume();
  } catch {
    /* autoplay policy */
  }
}

/** Ruido blanco en buffer para bursts mecánicos. */
export function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const samples = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Envolvente exponencial rápida (ataque + decaimiento). */
export function applyExpEnvelope(
  gain: GainNode,
  startAt: number,
  attackSec: number,
  peak: number,
  decaySec: number,
): void {
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startAt + attackSec);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + attackSec + decaySec);
}
