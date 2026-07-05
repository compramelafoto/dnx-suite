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

/** Pitido breve tipo cámara digital (1600–2200 Hz, ~100 ms). */
export function playFocusConfirmSound(confidence = 1): void {
  if (confidence < FOCUS_CONFIRM_MIN_CONFIDENCE) return;

  const ctx = getSimulatorAudioContext();
  if (!ctx) return;

  void resumeSimulatorAudio().catch(() => {});

  try {
    const dest = getSimulatorMasterGain(ctx);
    const t0 = ctx.currentTime + 0.004;
    const freq = 1600 + Math.min(1, confidence) * 600;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);

    const gain = ctx.createGain();
    applyExpEnvelope(gain, t0, 0.004, 0.12, 0.096);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t0);
    osc.stop(t0 + 0.102);
  } catch {
    /* audio bloqueado o contexto cerrado */
  }
}

/** @deprecated Usar playFocusConfirmSound */
export function playFocusConfirmBeep(confidence = 1): void {
  playFocusConfirmSound(confidence);
}

function playLensMotorWhir(
  ctx: AudioContext,
  dest: AudioNode,
  startAt: number,
  durationSec: number,
): void {
  const duration = Math.min(1.6, Math.max(0.1, durationSec));
  const t0 = startAt;

  const motor = ctx.createOscillator();
  motor.type = "sawtooth";
  motor.frequency.setValueAtTime(165, t0);
  motor.frequency.exponentialRampToValueAtTime(420, t0 + duration * 0.45);
  motor.frequency.exponentialRampToValueAtTime(240, t0 + duration * 0.82);
  motor.frequency.exponentialRampToValueAtTime(190, t0 + duration);

  const motorFilter = ctx.createBiquadFilter();
  motorFilter.type = "lowpass";
  motorFilter.frequency.setValueAtTime(520, t0);
  motorFilter.frequency.linearRampToValueAtTime(780, t0 + duration * 0.4);
  motorFilter.frequency.linearRampToValueAtTime(380, t0 + duration);
  motorFilter.Q.value = 1.1;

  const motorGain = ctx.createGain();
  motorGain.gain.setValueAtTime(0.0001, t0);
  motorGain.gain.exponentialRampToValueAtTime(0.055, t0 + 0.018);
  motorGain.gain.setValueAtTime(0.048, t0 + duration * 0.75);
  motorGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  motor.connect(motorFilter);
  motorFilter.connect(motorGain);
  motorGain.connect(dest);
  motor.start(t0);
  motor.stop(t0 + duration + 0.02);

  const buffer = createNoiseBuffer(ctx, duration);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    const p = i / data.length;
    const env = p < 0.15 ? p / 0.15 : p > 0.88 ? (1 - p) / 0.12 : 1;
    data[i] *= env * 0.85;
  }

  const grit = ctx.createBufferSource();
  grit.buffer = buffer;

  const gritFilter = ctx.createBiquadFilter();
  gritFilter.type = "bandpass";
  gritFilter.frequency.setValueAtTime(340, t0);
  gritFilter.frequency.exponentialRampToValueAtTime(620, t0 + duration * 0.5);
  gritFilter.frequency.exponentialRampToValueAtTime(300, t0 + duration);
  gritFilter.Q.value = 0.9;

  const gritGain = ctx.createGain();
  gritGain.gain.setValueAtTime(0.0001, t0);
  gritGain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.02);
  gritGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  grit.connect(gritFilter);
  gritFilter.connect(gritGain);
  gritGain.connect(dest);
  grit.start(t0);
  grit.stop(t0 + duration + 0.02);
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
