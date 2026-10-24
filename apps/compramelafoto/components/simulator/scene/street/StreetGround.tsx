"use client";

import { streetTexture, type StreetSurface } from "@/lib/simulator/street/street-assets";
import { BUILDING_LINE, CITY, STREET, laneDirection, type StreetLayout } from "@/lib/simulator/street/street-layout";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Material PBR con texturas en metros: `metersPerTile` es lo que cubre una repetición. */
function useSurface(surface: StreetSurface, metersPerTile: number): THREE.MeshStandardMaterial {
  const gl = useThree((s) => s.gl);
  const [diff, nor, arm] = useTexture([
    streetTexture(surface, "diff"),
    streetTexture(surface, "nor"),
    streetTexture(surface, "arm"),
  ]);
  return useMemo(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    const prep = (tex: THREE.Texture, color: boolean) => {
      const t = tex.clone();
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / metersPerTile, 1 / metersPerTile);
      t.anisotropy = Math.min(8, maxAniso);
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    const arms = prep(arm, false);
    return new THREE.MeshStandardMaterial({
      map: prep(diff, true),
      normalMap: prep(nor, false),
      aoMap: arms,
      roughnessMap: arms,
      metalnessMap: arms,
      metalness: 1,
      roughness: 1,
    });
  }, [diff, nor, arm, gl, metersPerTile]);
}

/** Rectángulo con esquinas redondeadas (el cordón dobla en la esquina) en el plano XZ. */
function roundedRect(x0: number, x1: number, z0: number, z1: number, radius: number): THREE.Shape {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [x1 - radius, z0 + radius, -Math.PI / 2],
    [x1 - radius, z1 - radius, 0],
    [x0 + radius, z1 - radius, Math.PI / 2],
    [x0 + radius, z0 + radius, Math.PI],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= 6; i += 1) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push([cx + radius * Math.cos(a), cz + radius * Math.sin(a)]);
    }
  }
  // El shape vive en XY; luego se acuesta (Y del shape = −Z del mundo).
  return new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
}

/**
 * Parte una geometría sin índice según sus grupos (de ExtrudeGeometry: 0 =
 * tapas, 1 = costados) para juntar después todas las tapas y todos los costados.
 */
function splitGroups(geo: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  for (const g of geo.groups) {
    const part = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) {
      const a = attr as THREE.BufferAttribute;
      const arr = (a.array as Float32Array).slice(g.start * a.itemSize, (g.start + g.count) * a.itemSize);
      part.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
    }
    out[g.materialIndex ?? 0] = out[g.materialIndex ?? 0] ? mergeGeometries([out[g.materialIndex ?? 0], part]) : part;
  }
  return out;
}

/** Plano horizontal con UV en metros. */
function flatQuad(cx: number, cz: number, width: number, depth: number, rotY = 0, y = 0): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, depth);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * width, uv.getY(i) * depth);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(rotY);
  geo.translate(cx, y, cz);
  return geo;
}

const PAINT = new THREE.MeshStandardMaterial({
  color: "#e9e7e0",
  roughness: 0.7,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});

/** Franjas de las sendas peatonales y líneas de PARE de todas las esquinas, en una sola malla. */
function paintMarks(): THREE.InstancedMesh {
  const marks: { x: number; z: number; w: number; d: number }[] = [];
  const center = STREET.roadHalf + STREET.sidewalk / 2;
  const length = STREET.sidewalk - 0.4;
  for (const X of CITY.lines) {
    for (const Z of CITY.lines) {
      for (const s of [1, -1]) {
        // Cruzando la calle en Z (como en Argentina, la senda continúa la vereda).
        for (let x = -STREET.roadHalf + 0.6; x <= STREET.roadHalf - 0.4; x += 1) marks.push({ x: X + x, z: Z + s * center, w: 0.5, d: length });
        // Cruzando la calle en X.
        for (let z = -STREET.roadHalf + 0.6; z <= STREET.roadHalf - 0.4; z += 1) marks.push({ x: X + s * center, z: Z + z, w: length, d: 0.5 });
      }
      // PARE: las calles en X frenan antes de la senda, del lado por el que llegan.
      const dir = laneDirection({ axis: "x", at: Z });
      marks.push({ x: X - dir * (BUILDING_LINE + 0.5), z: Z, w: 0.4, d: STREET.roadHalf * 2 - 0.4 });
    }
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, PAINT, marks.length);
  const m = new THREE.Matrix4();
  marks.forEach((k, i) => mesh.setMatrixAt(i, m.makeScale(k.w, 1, k.d).setPosition(k.x, 0.004, k.z)));
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Textura de la palabra PARE pintada en la calle (blanca, alargada como las reales). */
function pareTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(233,231,224,0.95)";
  g.font = "bold 150px 'Arial Narrow', Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.save();
  g.translate(128, 256);
  g.scale(0.6, 2.4);
  g.fillText("PARE", 0, 0);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function StreetGround({ layout }: { layout: StreetLayout }) {
  const asphalt = useSurface("asphalt", 4);
  const cobbles = useSurface("cobbles", 2);
  const sidewalk = useSurface("sidewalk", 1.6);
  const curb = useSurface("curb", 2);
  const grass = useSurface("grass", 3);
  const bricks = useSurface("bricks", 2);

  // Veredas de todas las manzanas en una sola malla (tapa = vereda, costado = cordón).
  const sidewalks = useMemo(() => {
    const pieces = layout.blocks.map((b) => {
      const geo = new THREE.ExtrudeGeometry(
        roundedRect(b.x0 - STREET.sidewalk, b.x1 + STREET.sidewalk, b.z0 - STREET.sidewalk, b.z1 + STREET.sidewalk, 2.2),
        { depth: STREET.curbHeight, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 1 },
      );
      // ExtrudeGeometry crece en +Z: se acuesta para que el espesor sea la altura.
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, -0.03, 0);
      return splitGroups(geo);
    });
    // Un grupo por material: 0 = vereda (tapas), 1 = cordón (costados).
    const caps = mergeGeometries(pieces.map((p) => p[0]));
    const sides = mergeGeometries(pieces.map((p) => p[1]));
    return mergeGeometries([caps, sides], true);
  }, [layout]);

  const road = useMemo(() => {
    const lo = CITY.reach[0] - 80;
    const hi = CITY.reach[1] + 80;
    return flatQuad((lo + hi) / 2, (lo + hi) / 2, hi - lo, hi - lo);
  }, []);

  const cobbled = useMemo(() => {
    const strips = layout.streets
      .filter((s) => s.cobbled)
      .map((s) => (s.axis === "z" ? flatQuad(s.at, (s.from + s.to) / 2, STREET.roadHalf * 2, s.to - s.from, 0, 0.002) : flatQuad((s.from + s.to) / 2, s.at, s.to - s.from, STREET.roadHalf * 2, 0, 0.002)));
    // Los pasajes también son de adoquines.
    for (const b of layout.blocks) {
      const a = b.alley;
      if (!a) continue;
      const mid = (a.from + a.to) / 2;
      const len = a.to - a.from + 1;
      strips.push(a.axis === "x" ? flatQuad(mid, a.at, len, a.width, 0, STREET.curbHeight + 0.004) : flatQuad(a.at, mid, a.width, len, 0, STREET.curbHeight + 0.004));
    }
    return strips.length ? mergeGeometries(strips) : null;
  }, [layout]);

  // Plaza: césped, senderos de ladrillo y el círculo del monumento.
  const plaza = useMemo(() => {
    const p = layout.plaza;
    const b = p.block;
    const top = STREET.curbHeight + 0.004;
    const lawn = flatQuad((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0, b.z1 - b.z0, 0, top);
    const paths = p.paths.map((s) => {
      const dx = s.to[0] - s.from[0];
      const dz = s.to[1] - s.from[1];
      const len = Math.hypot(dx, dz) + s.width;
      return flatQuad((s.from[0] + s.to[0]) / 2, (s.from[1] + s.to[1]) / 2, s.width, len, Math.atan2(dx, dz), top + 0.004);
    });
    const ring = new THREE.CircleGeometry(p.monumentRadius + 0.6, 48);
    const uv = ring.getAttribute("uv") as THREE.BufferAttribute;
    const r = (p.monumentRadius + 0.6) * 2;
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * r, uv.getY(i) * r);
    ring.rotateX(-Math.PI / 2);
    ring.translate(p.center[0], top + 0.008, p.center[1]);
    return { lawn, paths: mergeGeometries([...paths, ring]) };
  }, [layout]);

  const marks = useMemo(paintMarks, []);
  const pare = useMemo(() => {
    const tex = pareTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false });
    const spots: THREE.Matrix4[] = [];
    for (const X of CITY.lines) {
      for (const Z of CITY.lines) {
        const dir = laneDirection({ axis: "x", at: Z });
        // Se lee de frente al llegar: las letras van a lo largo del carril.
        const m = new THREE.Matrix4().makeRotationY(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        m.setPosition(X - dir * (BUILDING_LINE + 3.2), 0.005, Z);
        spots.push(m);
      }
    }
    const geo = new THREE.PlaneGeometry(2.4, 4.2);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.computeBoundingSphere();
    return mesh;
  }, []);

  return (
    <group name="calle-piso">
      <mesh geometry={road} receiveShadow material={asphalt} />
      {cobbled ? <mesh geometry={cobbled} receiveShadow material={cobbles} /> : null}
      <mesh geometry={sidewalks} material={[sidewalk, curb]} receiveShadow castShadow />
      <mesh geometry={plaza.lawn} material={grass} receiveShadow />
      <mesh geometry={plaza.paths} material={bricks} receiveShadow />
      <primitive object={marks} />
      <primitive object={pare} />
    </group>
  );
}
