/**
 * Calidad adaptable del render: el simulador mide cuántos cuadros por
 * segundo logra y baja o sube la calidad para quedar fluido en cada
 * computadora (de una notebook vieja a una con buena placa de video).
 * La foto conserva la óptica: sólo cambian costos de pantalla.
 */

export interface QualityTier {
  id: "baja" | "media" | "alta";
  /** Densidad de píxeles del lienzo (1 = un píxel CSS). */
  dpr: number;
  /** Lado del mapa de sombras del sol. */
  shadowMapSize: number;
  /** Sombras de contacto (SSAO). */
  ao: boolean;
  /** Muestras del desenfoque por píxel en el peor caso. */
  dofSteps: number;
  /** Faroles que iluminan de verdad a la vez (el resto sólo brilla). */
  lampLights: number;
}

export const QUALITY_TIERS: readonly QualityTier[] = [
  { id: "baja", dpr: 0.85, shadowMapSize: 1024, ao: false, dofSteps: 48, lampLights: 4 },
  { id: "media", dpr: 1, shadowMapSize: 2048, ao: true, dofSteps: 80, lampLights: 8 },
  { id: "alta", dpr: 1.5, shadowMapSize: 4096, ao: true, dofSteps: 128, lampLights: 12 },
];

/** Por debajo de esto se baja un escalón; por encima de lo otro, se sube. */
export const FPS_DOWN = 38;
export const FPS_UP = 56;
/** Segundos de medición antes de decidir (evita saltar por un tirón). */
export const WINDOW_DOWN_S = 2;
export const WINDOW_UP_S = 6;

export interface QualityGovernorState {
  tier: number;
  elapsed: number;
  frames: number;
  /** No vuelve a subir a un escalón del que ya tuvo que bajar. */
  ceiling: number;
}

export function createGovernor(start = 1): QualityGovernorState {
  return { tier: start, elapsed: 0, frames: 0, ceiling: QUALITY_TIERS.length - 1 };
}

/**
 * Suma un cuadro de `dt` segundos. Devuelve el escalón nuevo si cambió, o
 * null si sigue igual.
 */
export function governorTick(state: QualityGovernorState, dt: number): number | null {
  // Un cuadro de más de medio segundo es la pestaña en segundo plano: no cuenta.
  if (dt > 0.5) return null;
  state.elapsed += dt;
  state.frames += 1;
  const fps = state.frames / Math.max(1e-6, state.elapsed);
  if (state.elapsed >= WINDOW_DOWN_S && fps < FPS_DOWN && state.tier > 0) {
    state.ceiling = state.tier - 1;
    state.tier -= 1;
    state.elapsed = 0;
    state.frames = 0;
    return state.tier;
  }
  if (state.elapsed >= WINDOW_UP_S) {
    const up = fps > FPS_UP && state.tier < state.ceiling;
    state.elapsed = 0;
    state.frames = 0;
    if (up) {
      state.tier += 1;
      return state.tier;
    }
  }
  return null;
}
