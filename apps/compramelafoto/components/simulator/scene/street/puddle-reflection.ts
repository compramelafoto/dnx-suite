"use client";

import * as THREE from "three";

/**
 * Reflejo real de los charcos: la escena se dibuja una segunda vez desde una
 * cámara espejada bajo el plano del agua (como Reflector de three.js) y cada
 * charco toma de esa imagen lo que le corresponde. Así se ven reflejados la
 * gente que pasa, los autos, los edificios y el cielo, y se puede componer con
 * reflejos. Un solo plano para todos (todos los charcos están casi a la misma
 * altura): se usa el del charco más cercano.
 */

/** Resolución del reflejo respecto del lienzo (el agua lo ablanda igual). */
const RESOLUTION = 0.4;
/** En el espejo no se dibuja lo que queda más lejos que esto (ya lo tapa la bruma). */
const MIRROR_FAR = 90;

export interface PuddleUniforms {
  reflectMap: { value: THREE.Texture | null };
  reflectMatrix: { value: THREE.Matrix4 };
  /** 0 = sin reflejo (no se dibujó este cuadro), 1 = reflejo completo. */
  reflectStrength: { value: number };
  time: { value: number };
}

const _normal = new THREE.Vector3(0, 1, 0);
const _mirror = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _view = new THREE.Vector3();
const _look = new THREE.Vector3();
const _target = new THREE.Vector3();
const _rot = new THREE.Matrix4();
const _size = new THREE.Vector2();
const _ndc = new THREE.Vector3();

export class PuddleReflector {
  readonly uniforms: PuddleUniforms;
  readonly target: THREE.WebGLRenderTarget;
  readonly camera = new THREE.PerspectiveCamera();

  constructor() {
    // HalfFloat: guarda la luz sin recortar; el tono final lo pone la escena.
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.uniforms = {
      reflectMap: { value: this.target.texture },
      reflectMatrix: { value: new THREE.Matrix4() },
      reflectStrength: { value: 0 },
      time: { value: 0 },
    };
  }

  /**
   * Dibuja el reflejo para el plano y = `height`, sólo en la franja de pantalla
   * que ocupan `corners` (las esquinas de los charcos a la vista): lo que queda
   * fuera de esa franja ni se dibuja, y eso es la mayor parte de la ciudad.
   * `hide` son las mallas que no deben verse en el espejo. Devuelve false si los
   * charcos quedaron fuera del cuadro.
   */
  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    height: number,
    corners: THREE.Vector3[],
    hide: THREE.Object3D[],
  ): boolean {
    gl.getDrawingBufferSize(_size);

    // Cámara espejada: la posición y la mirada reflejadas en el plano.
    _mirror.set(0, height, 0);
    _camPos.setFromMatrixPosition(camera.matrixWorld);
    _mirror.x = _camPos.x;
    _mirror.z = _camPos.z;
    _view.subVectors(_mirror, _camPos).reflect(_normal).negate().add(_mirror);
    _rot.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rot).add(_camPos);
    _target.subVectors(_mirror, _look).reflect(_normal).negate().add(_mirror);
    const cam = this.camera;
    cam.position.copy(_view);
    cam.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_normal);
    cam.lookAt(_target);
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.zoom = camera.zoom;
    cam.near = camera.near;
    cam.far = Math.min(camera.far, MIRROR_FAR);
    cam.clearViewOffset();
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();

    // Franja que ocupan los charcos vistos por el espejo (con un margen para las ondas).
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const c of corners) {
      _ndc.copy(c).project(cam);
      if (_ndc.z > 1) continue;
      x0 = Math.min(x0, _ndc.x);
      x1 = Math.max(x1, _ndc.x);
      y0 = Math.min(y0, _ndc.y);
      y1 = Math.max(y1, _ndc.y);
    }
    const pad = 0.04;
    x0 = Math.max(-1, x0 - pad);
    x1 = Math.min(1, x1 + pad);
    y0 = Math.max(-1, y0 - pad);
    y1 = Math.min(1, y1 + pad);
    if (!(x1 > x0 && y1 > y0)) return false;
    const fullW = _size.x;
    const fullH = _size.y;
    const left = ((x0 + 1) / 2) * fullW;
    const top = ((1 - y1) / 2) * fullH;
    const width = ((x1 - x0) / 2) * fullW;
    const heightPx = ((y1 - y0) / 2) * fullH;
    cam.setViewOffset(fullW, fullH, left, top, width, heightPx);
    cam.updateProjectionMatrix();
    const w = Math.max(2, Math.round(width * RESOLUTION));
    const h = Math.max(2, Math.round(heightPx * RESOLUTION));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);

    this.uniforms.reflectMatrix.value
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(cam.projectionMatrix)
      .multiply(cam.matrixWorldInverse);

    // Sin plano de corte oblicuo (como Reflector): deformaba el volumen de la
    // vista y three.js dejaba de descartar lo que queda fuera, dibujando toda la
    // ciudad. Bajo el agua no hay nada que ver: el piso se oculta (`hide`).

    const was = hide.map((o) => o.visible);
    for (const o of hide) o.visible = false;
    const prevTarget = gl.getRenderTarget();
    const shadows = gl.shadowMap.autoUpdate;
    const shadowsPending = gl.shadowMap.needsUpdate;
    // Las sombras son de la vista principal: el espejo no las rehace ni "gasta" el
    // aviso de que toca rehacerlas en este cuadro.
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = false;
    // Las matrices de la escena ya están (del cuadro anterior): recorrer toda la
    // ciudad para recalcularlas costaba casi tanto como dibujar el reflejo.
    const autoMatrix = scene.matrixWorldAutoUpdate;
    scene.matrixWorldAutoUpdate = false;
    gl.setRenderTarget(this.target);
    gl.clear();
    gl.render(scene, cam);
    gl.setRenderTarget(prevTarget);
    scene.matrixWorldAutoUpdate = autoMatrix;
    gl.shadowMap.autoUpdate = shadows;
    gl.shadowMap.needsUpdate = shadowsPending;
    hide.forEach((o, i) => (o.visible = was[i]));
    return true;
  }

  dispose() {
    this.target.dispose();
  }
}

/**
 * Agrega el reflejo a un material de agua (MeshPhysicalMaterial): se suma como
 * luz propia, con más fuerza cuanto más rasante se mira (Fresnel) y apenas
 * ondulado por el viento. Funciona con mallas instanciadas.
 */
export function addPuddleReflection(material: THREE.MeshPhysicalMaterial, uniforms: PuddleUniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform mat4 reflectMatrix;\nvarying vec4 vReflectUv;\nvarying vec3 vWaterWorld;",
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
vec4 waterWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
waterWorld = instanceMatrix * waterWorld;
#endif
waterWorld = modelMatrix * waterWorld;
vWaterWorld = waterWorld.xyz;
vReflectUv = reflectMatrix * waterWorld;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D reflectMap;\nuniform float reflectStrength;\nuniform float time;\nvarying vec4 vReflectUv;\nvarying vec3 vWaterWorld;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
{
  vec2 ripple = vec2(
    sin(vWaterWorld.x * 9.0 + time * 1.7) + sin(vWaterWorld.z * 13.0 - time * 1.3),
    cos(vWaterWorld.z * 11.0 + time * 1.5) + sin(vWaterWorld.x * 7.0 + time * 1.1)
  ) * 0.0018;
  vec2 ruv = vReflectUv.xy / vReflectUv.w + ripple;
  vec3 reflected = texture2D(reflectMap, clamp(ruv, 0.0, 1.0)).rgb;
  // Un charco que quedó fuera de la franja dibujada no refleja (no hay imagen para él).
  vec2 edge = smoothstep(0.0, 0.02, ruv) * smoothstep(0.0, 0.02, 1.0 - ruv);
  reflected *= edge.x * edge.y;
  vec3 toEye = normalize(cameraPosition - vWaterWorld);
  float grazing = 1.0 - clamp(toEye.y, 0.0, 1.0);
  // Schlick con la base un poco más alta que el agua limpia (0,02): el asfalto
  // mojado de alrededor también brilla. Rasante es casi un espejo.
  float fresnel = 0.12 + 0.88 * pow(grazing, 5.0);
  totalEmissiveRadiance += reflected * fresnel * reflectStrength;
}`,
      );
  };
  material.customProgramCacheKey = () => "charco-con-reflejo";
}
