/**
 * Movimiento de ojos como el de una persona (sin three.js, para poder probarlo).
 *
 * Los ojos no siguen un punto de forma continua: saltan (sacadas) de un punto
 * a otro en 20 a 100 ms y se quedan quietos entre salto y salto, con un leve
 * temblor. Mirando a alguien a la cara hacen saltos chiquitos (de un ojo al
 * otro); caminando miran el camino, a los costados y, a veces, a la cámara.
 * Los saltos grandes suelen venir con un parpadeo. Ángulos en grados,
 * relativos a la cabeza: yaw positivo = a la izquierda de la persona, pitch
 * positivo = arriba.
 */

export interface EyeState {
  yaw: number;
  pitch: number;
  /** Salto en curso: desde dónde, hacia dónde, cuánto lleva y cuánto dura (s). */
  from: [number, number];
  to: [number, number];
  t: number;
  duration: number;
  /** Hasta cuándo se queda mirando el punto actual (s del reloj). */
  holdUntil: number;
  /** Desvío elegido alrededor del punto que se mira (microsacadas). */
  offset: [number, number];
  /** El último salto fue grande: pide un parpadeo. */
  blinkRequest: boolean;
  /** Mira a la cámara (en los paseantes, una mirada de reojo que dura un rato). */
  lookingAtCamera: boolean;
}

export const EYE_LIMIT_YAW = 35;
export const EYE_LIMIT_PITCH = 25;
/** Un salto más grande que esto viene con parpadeo. */
const BLINK_SACCADE = 14;

export function createEyeState(): EyeState {
  return { yaw: 0, pitch: 0, from: [0, 0], to: [0, 0], t: 1, duration: 0.05, holdUntil: 0, offset: [0, 0], blinkRequest: false, lookingAtCamera: false };
}

/** Duración de una sacada según su tamaño (la "secuencia principal" de los ojos humanos). */
export function saccadeDuration(amplitudeDeg: number): number {
  return Math.min(0.11, 0.021 + 0.0022 * amplitudeDeg);
}

/** Curva de mínimo tirón: arranca y frena suave, rápido en el medio. */
function minimumJerk(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (10 - 15 * x + 6 * x * x);
}

function clampGaze(yaw: number, pitch: number): [number, number] {
  return [Math.max(-EYE_LIMIT_YAW, Math.min(EYE_LIMIT_YAW, yaw)), Math.max(-EYE_LIMIT_PITCH, Math.min(EYE_LIMIT_PITCH, pitch))];
}

function startSaccade(s: EyeState, to: [number, number]) {
  const [y, p] = clampGaze(to[0], to[1]);
  const amp = Math.hypot(y - s.yaw, p - s.pitch);
  s.from = [s.yaw, s.pitch];
  s.to = [y, p];
  s.t = 0;
  s.duration = saccadeDuration(amp);
  if (amp > BLINK_SACCADE) s.blinkRequest = true;
}

export interface EyeGoal {
  /**
   * Punto a mirar (relativo a la cabeza): si hay, los ojos se quedan en él con
   * saltos chiquitos; si no, la persona mira alrededor.
   */
  fixate: [number, number] | null;
  /** Dónde está la cámara (relativo a la cabeza), si está a la vista y cerca. */
  camera: [number, number] | null;
}

/**
 * Avanza los ojos `dt` segundos. `now` es el reloj de la escena y `rand` un
 * generador en [0, 1) propio de cada persona.
 */
export function stepEyes(s: EyeState, goal: EyeGoal, now: number, dt: number, rand: () => number): EyeState {
  // Salto en curso.
  if (s.t < 1) {
    s.t = Math.min(1, s.t + dt / s.duration);
    const k = minimumJerk(s.t);
    s.yaw = s.from[0] + (s.to[0] - s.from[0]) * k;
    s.pitch = s.from[1] + (s.to[1] - s.from[1]) * k;
    return s;
  }

  const fixate = goal.fixate ?? (s.lookingAtCamera ? goal.camera : null);
  if (s.lookingAtCamera && !goal.camera) s.lookingAtCamera = false;

  if (fixate) {
    const target: [number, number] = [fixate[0] + s.offset[0], fixate[1] + s.offset[1]];
    const off = Math.hypot(target[0] - s.yaw, target[1] - s.pitch);
    if (off > 2.5) {
      // El punto se fue (la cabeza o la persona se movió): un salto para alcanzarlo.
      startSaccade(s, target);
      s.holdUntil = now + 0.25 + rand() * 0.5;
      return s;
    }
    // Seguimiento lento de lo que se mueve poco (persecución suave).
    const k = 1 - Math.exp(-dt * 12);
    s.yaw += (target[0] - s.yaw) * k;
    s.pitch += (target[1] - s.pitch) * k;
    if (now >= s.holdUntil) {
      // Microsacada: de un ojo al otro, o a la boca, de quien se mira.
      s.offset = [(rand() - 0.5) * 3, (rand() - 0.65) * 2.2];
      startSaccade(s, [fixate[0] + s.offset[0], fixate[1] + s.offset[1]]);
      s.holdUntil = now + 0.35 + rand() * 0.9;
      // Quien camina no se queda mucho mirando a la cámara.
      if (!goal.fixate && rand() < 0.35) s.lookingAtCamera = false;
    }
  } else if (now >= s.holdUntil) {
    // Mirar alrededor: más hacia adelante y un poco hacia abajo (el camino), a veces a los costados.
    if (goal.camera && rand() < 0.22) {
      s.lookingAtCamera = true;
      s.offset = [0, 0];
      startSaccade(s, goal.camera);
      s.holdUntil = now + 0.6 + rand() * 1.4;
      return s;
    }
    const wide = rand() < 0.25;
    const yaw = (rand() - 0.5) * (wide ? 60 : 24);
    const pitch = -4 - rand() * 12 + (wide ? 6 : 0);
    startSaccade(s, [yaw, pitch]);
    s.holdUntil = now + 0.5 + rand() * 2;
  }

  // Temblor mínimo entre salto y salto.
  s.yaw += (rand() - 0.5) * 0.08;
  s.pitch += (rand() - 0.5) * 0.06;
  return s;
}

/** Párpado que acompaña la mirada: al mirar abajo baja un poco (peso de parpadeo 0…1). */
export function lidFollow(pitchDeg: number): number {
  return pitchDeg < 0 ? Math.min(0.35, (-pitchDeg / EYE_LIMIT_PITCH) * 0.35) : 0;
}

/** Convergencia: cada ojo gira hacia adentro para mirar algo cercano (grados). */
export function vergence(distanceM: number): number {
  return (Math.atan(0.032 / Math.max(0.3, distanceM)) * 180) / Math.PI;
}
