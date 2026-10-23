/**
 * Shader de profundidad de campo por distancia (plano de enfoque).
 *
 * Cada píxel calcula el disco de desenfoque físico (lente delgada) en px
 * y junta las muestras vecinas con el método "bokeh de una pasada"
 * (espiral de ángulo áureo, Gustafsson 2018):
 * - un fondo desenfocado no se mete sobre un sujeto nítido delante;
 * - un primer plano desenfocado sí se derrama sobre lo que tiene detrás,
 *   como pasa con una lente real.
 * El cielo (sin profundidad) se trata como infinito: también se desenfoca.
 */

/** Pasos máximos de la espiral (tope del bucle en GLSL). */
export const DOF_MAX_STEPS = 160;
/** Pasos que se buscan para cubrir el disco más grande de la escena. */
export const DOF_TARGET_STEPS = 128;

export const DOF_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const DOF_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float focusDistance;
uniform float aperture;
uniform float focalLength;
uniform float sensorHeightMm;
uniform mat4 cameraInverseProjection;
uniform vec2 resolution;
uniform float maxBlurPx;
uniform float radScale;
uniform float exposureGain;
uniform vec3 wbTint;

varying vec2 vUv;

#define MAX_STEPS ${DOF_MAX_STEPS}
#define GOLDEN_ANGLE 2.39996323
#define FAR_AWAY_M 100000.0

float viewSpaceDistance(vec2 uv) {
  float depthSample = texture2D(tDepth, uv).r;
  if (depthSample >= 1.0) return FAR_AWAY_M;
  vec2 ndc = uv * 2.0 - 1.0;
  float z = depthSample * 2.0 - 1.0;
  vec4 view = cameraInverseProjection * vec4(ndc, z, 1.0);
  view /= view.w;
  return length(view.xyz);
}

/** Radio (px) del disco de desenfoque de un punto a distM. */
float blurRadiusPx(float distM) {
  float f = max(focalLength, 1.0);
  float s = max(focusDistance * 1000.0, f * 1.01);
  float d = max(distM, 0.05) * 1000.0;
  float discMm = (f * f * abs(d - s)) / (max(aperture, 1.0) * d * (s - f));
  float diameterPx = discMm / max(sensorHeightMm, 1e-3) * resolution.y;
  return min(diameterPx, maxBlurPx) * 0.5;
}

/** Ruido de gradiente intercalado: cambia el arranque de la espiral por píxel. */
float interleavedNoise(vec2 px) {
  return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))));
}

vec3 compressHighlights(vec3 rgb) {
  float peak = max(max(rgb.r, rgb.g), rgb.b);
  if (peak <= 1.0) return rgb;

  float knee = 1.0 + (peak - 1.0) / (1.0 + (peak - 1.0) * 2.8);
  vec3 scaled = rgb * (knee / peak);
  float blow = smoothstep(1.0, 2.2, peak);
  return mix(scaled, vec3(knee), blow * 0.9);
}

vec4 applyExposure(vec4 color) {
  vec3 rgb = color.rgb * exposureGain * wbTint;
  rgb = compressHighlights(rgb);
  return vec4(rgb, color.a);
}

void main() {
  vec4 sharp = texture2D(tColor, vUv);
  float maxRadius = maxBlurPx * 0.5;

  if (maxRadius < 0.25) {
    gl_FragColor = applyExposure(sharp);
    return;
  }

  float centerDist = viewSpaceDistance(vUv);
  float centerSize = blurRadiusPx(centerDist);

  vec3 color = sharp.rgb;
  float tot = 1.0;
  float radius = sqrt(radScale);
  float angle = interleavedNoise(gl_FragCoord.xy) * 6.2831853;

  for (int i = 0; i < MAX_STEPS; i++) {
    if (radius >= maxRadius) break;
    vec2 tc = vUv + vec2(cos(angle), sin(angle)) * radius / resolution;
    float sampleDist = viewSpaceDistance(tc);
    float sampleSize = blurRadiusPx(sampleDist);
    // Lo que está detrás no puede desenfocarse sobre algo más cercano y nítido.
    if (sampleDist > centerDist) sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
    vec3 sampleColor = texture2D(tColor, tc).rgb;
    color += mix(color / tot, sampleColor, m);
    tot += 1.0;
    radius += radScale / radius;
    angle += GOLDEN_ANGLE;
  }

  gl_FragColor = applyExposure(vec4(color / tot, sharp.a));
}
`;

/**
 * Paso de la espiral para cubrir un radio con ~DOF_TARGET_STEPS muestras.
 * radio² crece ≈ 2·radScale por paso; nunca menos de 0,5 px.
 */
export function dofRadiusScale(maxBlurDiameterPx: number): number {
  const maxRadius = maxBlurDiameterPx / 2;
  return Math.max(0.5, (maxRadius * maxRadius) / (2 * DOF_TARGET_STEPS));
}
