"use client";

import { streetTexture, type StreetSurface } from "@/lib/simulator/street/street-assets";
import { BUILDING_LINE, STREET } from "@/lib/simulator/street/street-layout";
import { useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

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

/**
 * Vereda de un cuadrante en el plano XZ: del cordón a la línea de edificación,
 * con cordón redondeado en la esquina y ochava contra los edificios.
 */
function sidewalkShape(sx: 1 | -1, sz: 1 | -1): THREE.Shape {
  const r = STREET.roadHalf;
  const L = BUILDING_LINE;
  const c = STREET.chamfer;
  const radius = 2.2;
  const pts: [number, number][] = [
    [r, STREET.mainLength + 2],
    [r, r + radius],
  ];
  for (let i = 1; i < 8; i += 1) {
    const a = Math.PI + (i / 8) * (Math.PI / 2);
    pts.push([r + radius + radius * Math.cos(a), r + radius + radius * Math.sin(a)]);
  }
  pts.push([r + radius, r], [STREET.crossLength + 2, r], [STREET.crossLength + 2, L], [L + c, L], [L, L + c], [L, STREET.mainLength + 2]);
  // El shape vive en XY; luego se acuesta (Y del shape = −Z del mundo).
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(sx * x, -sz * z)));
  return shape;
}

const PAINT = new THREE.MeshStandardMaterial({
  color: "#e9e7e0",
  roughness: 0.7,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});

/**
 * Sendas peatonales (cebra) y líneas de detención. Como en Argentina, la senda
 * continúa la vereda: va entre el cordón y la línea de edificación.
 */
function crosswalkStripes(): { position: [number, number, number]; size: [number, number]; rotY: number }[] {
  const out: { position: [number, number, number]; size: [number, number]; rotY: number }[] = [];
  const center = STREET.roadHalf + STREET.sidewalk / 2;
  const length = STREET.sidewalk - 0.4;
  for (const s of [1, -1]) {
    // Cruzando la calle principal: franjas paralelas al tránsito.
    for (let x = -STREET.roadHalf + 0.6; x <= STREET.roadHalf - 0.4; x += 1) {
      out.push({ position: [x, 0.004, s * center], size: [0.5, length], rotY: 0 });
    }
    // Cruzando la transversal.
    for (let z = -STREET.roadHalf + 0.6; z <= STREET.roadHalf - 0.4; z += 1) {
      out.push({ position: [s * center, 0.004, z], size: [length, 0.5], rotY: 0 });
    }
  }
  // Líneas de detención antes de la senda, del lado por el que llega el tránsito
  // (la principal sube hacia +Z y la transversal va hacia −X).
  const stop = STREET.roadHalf + STREET.sidewalk + 0.5;
  out.push({ position: [0, 0.004, -stop], size: [STREET.roadHalf * 2 - 0.4, 0.4], rotY: 0 });
  out.push({ position: [stop, 0.004, 0], size: [0.4, STREET.roadHalf * 2 - 0.4], rotY: 0 });
  return out;
}

export default function StreetGround() {
  const asphalt = useSurface("asphalt", 4);
  const sidewalk = useSurface("sidewalk", 1.6);
  const curb = useSurface("curb", 2);

  const sidewalks = useMemo(() => {
    const out: THREE.ExtrudeGeometry[] = [];
    for (const sx of [1, -1] as const) {
      for (const sz of [1, -1] as const) {
        const geo = new THREE.ExtrudeGeometry(sidewalkShape(sx, sz), {
          depth: STREET.curbHeight,
          bevelEnabled: true,
          bevelSize: 0.03,
          bevelThickness: 0.03,
          bevelSegments: 2,
          curveSegments: 1,
        });
        // ExtrudeGeometry crece en +Z: se acuesta para que el espesor sea la altura.
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, -0.03, 0);
        out.push(geo);
      }
    }
    return out;
  }, []);

  const stripes = useMemo(crosswalkStripes, []);
  const road = useMemo(() => {
    // UV en metros, como las veredas, para que la textura tenga escala real.
    const size = (STREET.mainLength + 20) * 2;
    const geo = new THREE.PlaneGeometry(size, size);
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * size, uv.getY(i) * size);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  return (
    <group>
      <mesh geometry={road} receiveShadow material={asphalt} />
      {sidewalks.map((geo, i) => (
        <mesh key={i} geometry={geo} material={[sidewalk, curb]} receiveShadow castShadow />
      ))}
      {stripes.map((s, i) => (
        <mesh key={i} position={s.position} rotation-x={-Math.PI / 2} material={PAINT} receiveShadow>
          <planeGeometry args={s.size} />
        </mesh>
      ))}
    </group>
  );
}
