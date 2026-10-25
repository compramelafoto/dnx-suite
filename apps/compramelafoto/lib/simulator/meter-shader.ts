/**
 * Reduce el recuadro de captura a una grilla chica de luminancia lineal para
 * el fotómetro (cada celda promedia 4×4 muestras del render HDR).
 * El código GLSL debe quedar en ASCII.
 */

export const METER_GRID_WIDTH = 48;
export const METER_GRID_HEIGHT = 32;
/** Cada cuánto se lee la GPU (leer frena el cuadro, no conviene hacerlo siempre). */
export const METER_INTERVAL_MS = 120;

/**
 * Celulares sin render en punto flotante: la luminancia va en un byte, en
 * escala logarítmica de METER_LOG_RANGE pasos a partir de 2^-METER_LOG_OFFSET
 * (≈0,1 EV por escalón, alcanza para medir).
 */
export const METER_LOG_OFFSET = 16;
export const METER_LOG_RANGE = 24;

/** Pasa el byte del modo logarítmico (0–255) a luminancia lineal. */
export function decodeMeterByte(value: number): number {
  return Math.pow(2, (value / 255) * METER_LOG_RANGE - METER_LOG_OFFSET);
}

export const METER_DOWNSAMPLE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 cropMin;
uniform vec2 cropSize;
uniform vec2 gridSize;
uniform float logEncode;

varying vec2 vUv;

void main() {
  vec2 cell = cropSize / gridSize;
  vec2 base = cropMin + floor(vUv * gridSize) * cell;
  float sum = 0.0;
  for (int i = 0; i < 4; i++) {
    for (int j = 0; j < 4; j++) {
      vec2 uv = base + (vec2(float(i), float(j)) + 0.5) / 4.0 * cell;
      vec3 c = texture2D(tColor, uv).rgb;
      sum += dot(c, vec3(0.2126, 0.7152, 0.0722));
    }
  }
  float lum = sum / 16.0;
  if (logEncode > 0.5) {
    lum = clamp((log2(max(lum, 1e-7)) + ${METER_LOG_OFFSET.toFixed(1)}) / ${METER_LOG_RANGE.toFixed(1)}, 0.0, 1.0);
  }
  gl_FragColor = vec4(lum, 0.0, 0.0, 1.0);
}
`;
