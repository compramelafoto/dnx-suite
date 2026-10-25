/**
 * Oclusión ambiental en pantalla (SSAO): oscurece rincones, la base de las
 * paredes, debajo de los autos y donde los pies tocan el piso, a partir de la
 * profundidad del render. Se calcula a media resolución y el pase final la
 * suaviza al aplicarla. El código GLSL debe quedar en ASCII.
 */

/** Radio de búsqueda en el mundo (m): del orden de un zócalo o un cordón. */
export const AO_RADIUS_M = 0.7;
/** Cuánto oscurece como máximo (0 = nada). */
export const AO_STRENGTH = 0.75;
export const AO_SAMPLES = 12;

export const AO_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 cameraProjection;
uniform mat4 cameraInverseProjection;
uniform vec2 resolution;
uniform float radius;

varying vec2 vUv;

#define SAMPLES ${AO_SAMPLES}
#define GOLDEN_ANGLE 2.39996323

vec3 viewPos(vec2 uv) {
  float d = texture2D(tDepth, uv).r;
  vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 view = cameraInverseProjection * clip;
  return view.xyz / view.w;
}

float hash(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  float depth = texture2D(tDepth, vUv).r;
  if (depth >= 1.0) {
    gl_FragColor = vec4(1.0);
    return;
  }
  vec2 texel = 1.0 / resolution;
  vec3 p = viewPos(vUv);
  vec3 n = normalize(cross(viewPos(vUv + vec2(texel.x, 0.0)) - p, viewPos(vUv + vec2(0.0, texel.y)) - p));
  // Radio en pantalla: lo que mide "radius" metros a esta distancia.
  float screenRadius = radius * cameraProjection[1][1] * 0.5 / max(0.1, -p.z);
  float occlusion = 0.0;
  float angle = hash(gl_FragCoord.xy) * 6.2831853;
  for (int i = 0; i < SAMPLES; i++) {
    float r = screenRadius * sqrt((float(i) + 0.5) / float(SAMPLES));
    vec2 offset = vec2(cos(angle), sin(angle)) * r;
    angle += GOLDEN_ANGLE;
    vec3 s = viewPos(vUv + offset);
    vec3 v = s - p;
    float dist = length(v);
    float facing = max(0.0, dot(v, n) / max(dist, 1e-4) - 0.12);
    // Sólo cuenta lo que está cerca: un edificio lejano detrás no ocluye.
    float range = 1.0 - smoothstep(radius * 0.5, radius, dist);
    occlusion += facing * range;
  }
  float ao = 1.0 - occlusion / float(SAMPLES);
  gl_FragColor = vec4(ao, ao, ao, 1.0);
}
`;
