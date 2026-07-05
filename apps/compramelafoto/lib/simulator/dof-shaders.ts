/**
 * Shader de profundidad de campo por distancia (plano de enfoque).
 * CoC físico + rampa gradual; sin zona “todo nítido” artificial.
 */

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
uniform float cameraNear;
uniform float cameraFar;
uniform mat4 cameraInverseProjection;
uniform vec2 resolution;
uniform float maxBlurPx;
uniform float nearLimit;
uniform float farLimit;
uniform float farLimitFinite;
uniform float cocMm;
uniform float blurStrength;
uniform float transitionSoftness;
uniform float frontFalloff;
uniform float backFalloff;
uniform float exposureGain;
uniform vec3 wbTint;

varying vec2 vUv;

float smoothstep01(float edge0, float edge1, float x) {
  float denom = edge1 - edge0;
  if (abs(denom) < 1e-6) return x >= edge1 ? 1.0 : 0.0;
  float t = clamp((x - edge0) / denom, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float viewSpaceDistance(vec2 uv, float depthSample) {
  vec2 ndc = uv * 2.0 - 1.0;
  float z = depthSample * 2.0 - 1.0;
  vec4 clip = vec4(ndc, z, 1.0);
  vec4 view = cameraInverseProjection * clip;
  view /= view.w;
  return length(view.xyz);
}

float cocDiameterMm(float focusDist, float pixelDist, float focalMm, float ap) {
  float f = max(focalMm, 1.0);
  float s = max(focusDist, 0.3) * 1000.0;
  float d = max(pixelDist, 0.15) * 1000.0;
  float denom = max(ap, 1.0) * d * abs(s - f);
  if (denom < 1e-4) return 0.0;
  return (f * f * abs(s - d)) / denom;
}

float defocusAmount(float pixelDist) {
  float coc = cocDiameterMm(focusDistance, pixelDist, focalLength, aperture);
  float cocNorm = coc / max(cocMm, 1e-6);

  float softLow = 0.04 * (1.0 - transitionSoftness * 0.35);
  float softHigh = 1.35 + transitionSoftness * 1.15;
  float amount = smoothstep01(softLow, softHigh, cocNorm);

  bool inFront = pixelDist < focusDistance;
  if (inFront) {
    amount = 1.0 - pow(max(1.0 - amount, 0.0), frontFalloff);
  } else {
    amount = 1.0 - pow(max(1.0 - amount, 0.0), 1.0 / max(backFalloff, 0.5));
  }

  return clamp(amount * blurStrength, 0.0, 1.0);
}

vec4 sampleBlur(sampler2D tex, vec2 uv, float radiusPx) {
  vec4 sum = vec4(0.0);
  float wSum = 0.0;
  float sigma = max(radiusPx * 0.55, 0.001);

  for (int x = -5; x <= 5; x++) {
    for (int y = -5; y <= 5; y++) {
      vec2 offset = vec2(float(x), float(y)) * sigma / resolution;
      float r2 = float(x * x + y * y);
      float w = exp(-r2 / 18.0);
      sum += texture2D(tex, uv + offset) * w;
      wSum += w;
    }
  }

  return sum / max(wSum, 1e-4);
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
  float depth = texture2D(tDepth, vUv).r;

  if (depth >= 1.0) {
    gl_FragColor = applyExposure(sharp);
    return;
  }

  float pixelDist = viewSpaceDistance(vUv, depth);
  float blurNorm = defocusAmount(pixelDist);

  if (blurNorm < 0.0008) {
    gl_FragColor = applyExposure(sharp);
    return;
  }

  float radiusPx = blurNorm * maxBlurPx;
  vec4 blurred = sampleBlur(tColor, vUv, radiusPx);
  float blend = smoothstep01(0.0, 1.0, pow(blurNorm, 0.82));
  gl_FragColor = applyExposure(mix(sharp, blurred, blend));
}
`;
