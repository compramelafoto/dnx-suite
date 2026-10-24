"use client";

import * as THREE from "three";
import { isTouchGameDevice } from "@/lib/simulator/touch-input";

/**
 * Impostor: una "foto" del modelo (con transparencia) sobre dos planos
 * cruzados. De lejos un árbol de 300 000 triángulos se ve igual con cuatro.
 * La foto se saca una vez, al cargar, con luz pareja (sólo el color del
 * material): la luz real del día la pone la escena sobre los planos.
 */
export interface Impostor {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  /** Para las sombras: recorta igual que el color. */
  depthMaterial: THREE.MeshDepthMaterial;
  /**
   * Vuelve a sacar la foto. Si se sacó antes de que llegaran las texturas (las
   * hojas), quedaba vacía y el árbol lejano era invisible: se repite al
   * terminar la carga, cuando ya está todo en la placa de video.
   */
  refresh: () => void;
  dispose: () => void;
}

const RESOLUTION = 1024;
/** Celular: foto más chica y sin suavizado múltiple (las dos sumaban más de 200 MB de memoria). */
const MOBILE_RESOLUTION = 256;

export function makeImpostor(gl: THREE.WebGLRenderer, source: THREE.Object3D): Impostor {
  const model = source.clone(true);
  // Hojas semitransparentes: para la foto van recortadas y opacas. Si no, al
  // achicarse la textura la transparencia se diluye y el árbol sale pelado.
  const swapped: THREE.Material[] = [];
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const fix = (m: THREE.Material) => {
      const c = m.clone();
      if (c.transparent) {
        c.transparent = false;
        c.alphaTest = 0.2;
        c.depthWrite = true;
      }
      // Lo que pasa el recorte queda opaco en la foto (la hoja escribiría su transparencia parcial).
      c.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n\tgl_FragColor.a = 1.0;");
      };
      c.customProgramCacheKey = () => "impostor-opaco";
      swapped.push(c);
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fix) : fix(mesh.material);
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const half = Math.max(size.x, size.z) / 2;
  const height = size.y;
  const width = half * 2;

  const scene = new THREE.Scene();
  // Con luz ambiente π, el difuso sale igual al color del material (albedo).
  scene.add(new THREE.AmbientLight("#ffffff", Math.PI));
  scene.add(model);
  const camera = new THREE.OrthographicCamera(-half, half, box.max.y, box.min.y, 0.1, 1000);
  camera.position.set(center.x, 0, center.z + 500);
  camera.lookAt(center.x, 0, center.z);

  const mobile = isTouchGameDevice();
  const resolution = mobile ? MOBILE_RESOLUTION : RESOLUTION;
  const target = new THREE.WebGLRenderTarget(resolution, Math.max(64, Math.round((resolution * height) / width)), {
    samples: mobile ? 0 : 4,
    colorSpace: THREE.LinearSRGBColorSpace,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const capture = () => {
    const prevTarget = gl.getRenderTarget();
    const prevClear = gl.getClearColor(new THREE.Color());
    const prevAlpha = gl.getClearAlpha();
    const prevTone = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClear, prevAlpha);
    gl.toneMapping = prevTone;
  };
  capture();

  // Dos planos cruzados, con la base en y = 0 y el centro en el tronco.
  const a = new THREE.PlaneGeometry(width, height);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  for (const g of [a, b]) g.translate(center.x, height / 2 + box.min.y, center.z);
  const parts = [a, b];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (const g of parts) {
    const base = positions.length / 3;
    positions.push(...(g.getAttribute("position").array as Float32Array));
    normals.push(...(g.getAttribute("normal").array as Float32Array));
    uvs.push(...(g.getAttribute("uv").array as Float32Array));
    for (const i of g.getIndex()!.array as Uint16Array) index.push(base + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  // Normales hacia arriba: los dos planos reciben la misma luz y no se nota el cruce.
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  a.dispose();
  b.dispose();

  const material = new THREE.MeshStandardMaterial({
    map: target.texture,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
  });
  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: target.texture, alphaTest: 0.35 });
  return {
    geometry,
    material,
    depthMaterial,
    refresh: capture,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      depthMaterial.dispose();
      target.dispose();
      for (const m of swapped) m.dispose();
    },
  };
}
