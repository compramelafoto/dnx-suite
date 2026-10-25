/**
 * Sonido de enfoque AF — Cam Of Duty.
 * Motor de lente + pitido de confirmación (Web Audio API).
 */

import {
  applyExpEnvelope,
  createNoiseBuffer,
  getSimulatorAudioContext,
  getSimulatorMasterGain,
  resumeSimulatorAudio,
} from "./sound-engine";

/** Umbral alineado con FOCUS_OK en FocusMotorDrive. */
export const FOCUS_CONFIRM_MIN_CONFIDENCE = 0.4;

/**
 * Confirmación de foco: el doble "pi-pip" del zumbador piezoeléctrico de una
 * réflex (dos tonos cortos de ~2,7 kHz). Con poca confianza no suena.
 */
export function playFocusConfirmSound(confidence = 1): void {
  if (confidence < FOCUS_CONFIRM_MIN_CONFIDENCE) return;

  const ctx = getSimulatorAudioContext();
  if (!ctx) return;

  void resumeSimulatorAudio().catch(() => {});

  try {
    const dest = getSimulatorMasterGain(ctx);
    // El piezo es áspero (onda cuadrada) pero chico: se le sacan los agudos de más.
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 5200;
    tone.Q.value = 0.7;
    tone.connect(dest);
    const t0 = ctx.currentTime + 0.004;
    for (const at of [t0, t0 + 0.095]) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(2730, at);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(0.032, at + 0.003);
      gain.gain.setValueAtTime(0.032, at + 0.047);
      gain.gain.linearRampToValueAtTime(0.0001, at + 0.052);
      osc.connect(gain);
      gain.connect(tone);
      osc.start(at);
      osc.stop(at + 0.055);
    }
  } catch {
    /* audio bloqueado o contexto cerrado */
  }
}

/** @deprecated Usar playFocusConfirmSound */
export function playFocusConfirmBeep(confidence = 1): void {
  playFocusConfirmSound(confidence);
}

/**
 * Motor del objetivo (ultrasónico o paso a paso): un "zzt" suave y agudo,
 * con el leve tableteo de los engranajes, y un clic al arrancar y al frenar.
 * Nada de zumbido grave: los objetivos modernos casi no se oyen.
 */
function playLensMotorWhir(
  ctx: AudioContext,
  dest: AudioNode,
  startAt: number,
  durationSec: number,
): void {
  const duration = Math.min(1.2, Math.max(0.08, durationSec));
  const t0 = startAt;

  const buffer = createNoiseBuffer(ctx, duration + 0.02);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(2300, t0);
  // Acelera al empezar a buscar y desacelera al llegar.
  band.frequency.linearRampToValueAtTime(3100, t0 + duration * 0.35);
  band.frequency.linearRampToValueAtTime(2500, t0 + duration);
  band.Q.value = 2.4;

  // Tableteo de engranajes: la amplitud ondula ~110 veces por segundo.
  const ripple = ctx.createOscillator();
  ripple.frequency.value = 110;
  const rippleDepth = ctx.createGain();
  rippleDepth.gain.value = 0.006;
  const level = ctx.createGain();
  level.gain.setValueAtTime(0.0001, t0);
  level.gain.linearRampToValueAtTime(0.014, t0 + 0.012);
  level.gain.setValueAtTime(0.014, t0 + duration - 0.02);
  level.gain.linearRampToValueAtTime(0.0001, t0 + duration);
  ripple.connect(rippleDepth);
  rippleDepth.connect(level.gain);

  noise.connect(band);
  band.connect(level);
  level.connect(dest);
  noise.start(t0);
  noise.stop(t0 + duration + 0.02);
  ripple.start(t0);
  ripple.stop(t0 + duration + 0.02);

  // Clic mecánico al arrancar y al frenar.
  for (const at of [t0, t0 + duration]) {
    const click = ctx.createBufferSource();
    click.buffer = createNoiseBuffer(ctx, 0.008);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3500;
    const g = ctx.createGain();
    applyExpEnvelope(g, at, 0.0008, 0.05, 0.006);
    click.connect(hp);
    hp.connect(g);
    g.connect(dest);
    click.start(at);
    click.stop(at + 0.01);
  }
}

/**
 * Motor durante el barrido del plano de enfoque.
 * El pitido se reproduce al completar (playFocusConfirmSound).
 */
export function playFocusMotorSound(durationSec: number): void {
  const ctx = getSimulatorAudioContext();
  if (!ctx) return;

  void resumeSimulatorAudio().catch(() => {});

  try {
    playLensMotorWhir(ctx, getSimulatorMasterGain(ctx), ctx.currentTime, durationSec);
  } catch {
    /* ignore */
  }
}
