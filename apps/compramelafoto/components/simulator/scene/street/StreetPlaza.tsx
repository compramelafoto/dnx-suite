"use client";

import { STREET, type Plaza } from "@/lib/simulator/street/street-layout";
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import ArgentineFlag from "./ArgentineFlag";

/** Normal de agua con ondas suaves (se desplaza para que el reflejo tiemble). */
function rippleTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const a = (x / size) * Math.PI * 2;
      const b = (y / size) * Math.PI * 2;
      const nx = Math.sin(a * 3 + Math.cos(b * 2) * 1.5) * 0.5 + Math.sin(a * 7 + b * 5) * 0.2;
      const ny = Math.cos(b * 4 + Math.sin(a * 2)) * 0.5 + Math.cos(a * 5 - b * 6) * 0.2;
      const i = (y * size + x) * 4;
      img.data[i] = 128 + nx * 60;
      img.data[i + 1] = 128 + ny * 60;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/**
 * Lo construido de la plaza: el monumento (pedestal y mástil con la bandera) y la fuente con agua
 * que refleja el cielo. La estatua, los bancos y los faroles están en StreetProps.
 */
export default function StreetPlaza({ plaza }: { plaza: Plaza }) {
  const h = STREET.curbHeight;
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a39c8e", roughness: 0.82 }), []);
  const darkStone = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7a746a", roughness: 0.85 }), []);
  const granite = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8c4a3b", roughness: 0.38, metalness: 0.05 }), []);
  const ripples = useMemo(rippleTexture, []);
  const water = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#0f1719",
        roughness: 0.06,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        normalMap: ripples,
        normalScale: new THREE.Vector2(0.1, 0.1),
        envMapIntensity: 0.75,
      }),
    [ripples],
  );
  const basin = useMemo(() => {
    // Perfil del borde de la fuente (sección), girado alrededor del eje.
    const r = plaza.fountain.radius;
    const pts = [
      [r - 0.45, 0],
      [r, 0],
      [r + 0.05, 0.5],
      [r - 0.05, 0.62],
      [r - 0.4, 0.62],
      [r - 0.45, 0.3],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 48);
  }, [plaza.fountain.radius]);

  useFrame((_, delta) => {
    ripples.offset.x += delta * 0.03;
    ripples.offset.y += delta * 0.017;
  });

  const [cx, cz] = plaza.center;
  const f = plaza.fountain;
  return (
    <group name="calle-plaza">
      {/* Monumento al Libertador: escalinata, pedestal alto de granito rojizo pulido y cornisa (como el de Rosario). */}
      <mesh position={[cx, h + 0.15, cz]} material={darkStone} castShadow receiveShadow>
        <boxGeometry args={[9, 0.3, 9]} />
      </mesh>
      <mesh position={[cx, h + 0.45, cz]} material={granite} castShadow receiveShadow>
        <boxGeometry args={[7.6, 0.3, 7.6]} />
      </mesh>
      <mesh position={[cx, h + 0.75, cz]} material={granite} castShadow receiveShadow>
        <boxGeometry args={[6.4, 0.3, 6.4]} />
      </mesh>
      <mesh position={[cx, h + 1.15, cz]} material={granite} castShadow receiveShadow>
        <boxGeometry args={[5.2, 0.5, 5.2]} />
      </mesh>
      <mesh position={[cx, h + 3.2, cz]} material={granite} castShadow receiveShadow>
        <boxGeometry args={[4.2, 3.6, 4.2]} />
      </mesh>
      <mesh position={[cx, h + 5.1, cz]} material={granite} castShadow receiveShadow>
        <boxGeometry args={[4.7, 0.25, 4.7]} />
      </mesh>
      <mesh position={[cx, h + 5.27, cz]} material={granite} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.1, 4.4]} />
      </mesh>
      <ArgentineFlag position={[cx + plaza.flagOffset[0], h, cz + plaza.flagOffset[1]]} />

      {/* Fuente: borde, agua y columna con taza. */}
      <group position={[f.center[0], h, f.center[1]]}>
        <mesh geometry={basin} material={stone} castShadow receiveShadow />
        <mesh position={[0, 0.42, 0]} rotation-x={-Math.PI / 2} material={water} receiveShadow>
          <circleGeometry args={[f.radius - 0.42, 48]} />
        </mesh>
        <mesh position={[0, 0.9, 0]} material={stone} castShadow>
          <cylinderGeometry args={[0.22, 0.3, 1.8, 16]} />
        </mesh>
        <mesh position={[0, 1.85, 0]} material={stone} castShadow receiveShadow>
          <cylinderGeometry args={[0.9, 0.35, 0.3, 24]} />
        </mesh>
        <mesh position={[0, 1.96, 0]} rotation-x={-Math.PI / 2} material={water}>
          <circleGeometry args={[0.82, 24]} />
        </mesh>
      </group>
    </group>
  );
}
