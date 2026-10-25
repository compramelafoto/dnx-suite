"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

/** Proporción oficial 9:14 (alto:largo). */
const FLAG_LENGTH = 4.2;
const FLAG_HEIGHT = (FLAG_LENGTH * 9) / 14;
const POLE_HEIGHT = 16;
const CELESTE = "#74acdf";
const SUN_GOLD = "#f6b40e";
const SUN_DARK = "#85340a";

/** Bandera de ceremonia: franjas celeste-blanca-celeste y Sol de Mayo de 32 rayos. */
function flagTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = Math.round((w * 9) / 14);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = CELESTE;
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#ffffff";
  g.fillRect(0, h / 3, w, h / 3);

  // Sol de Mayo: 16 rayos rectos y 16 flamígeros alternados, cara y contorno.
  const cx = w / 2;
  const cy = h / 2;
  const r = h * 0.075;
  g.save();
  g.translate(cx, cy);
  g.fillStyle = SUN_GOLD;
  g.strokeStyle = SUN_DARK;
  g.lineWidth = 1.5;
  for (let i = 0; i < 32; i += 1) {
    g.save();
    g.rotate((i / 32) * Math.PI * 2);
    g.beginPath();
    if (i % 2 === 0) {
      g.moveTo(-r * 0.12, r * 0.9);
      g.lineTo(0, r * 2.05);
      g.lineTo(r * 0.12, r * 0.9);
    } else {
      g.moveTo(-r * 0.1, r * 0.9);
      g.quadraticCurveTo(r * 0.25, r * 1.25, -r * 0.08, r * 1.5);
      g.quadraticCurveTo(r * 0.2, r * 1.7, 0, r * 1.9);
      g.quadraticCurveTo(r * 0.05, r * 1.5, r * 0.12, r * 0.9);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Cara: ojos, nariz y boca, en el tono oscuro del contorno.
  g.strokeStyle = SUN_DARK;
  g.lineWidth = 2;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(s * r * 0.35, -r * 0.12, r * 0.12, Math.PI * 0.1, Math.PI * 0.9);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(0, -r * 0.05);
  g.lineTo(-r * 0.06, r * 0.25);
  g.lineTo(r * 0.06, r * 0.28);
  g.stroke();
  g.beginPath();
  g.arc(0, r * 0.38, r * 0.2, Math.PI * 0.2, Math.PI * 0.8);
  g.stroke();
  g.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Mástil con la bandera argentina flameando: la tela ondula con el viento, más
 * cuanto más lejos del mástil (ahí está agarrada).
 */
export default function ArgentineFlag({ position }: { position: [number, number, number] }) {
  const { flag, time } = useMemo(() => {
    const time = { value: 0 };
    const geometry = new THREE.PlaneGeometry(FLAG_LENGTH, FLAG_HEIGHT, 32, 12);
    // La tela arranca en el mástil (x = 0) y se extiende hacia +X.
    geometry.translate(FLAG_LENGTH / 2, 0, 0);
    const material = new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.85 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.flagTime = time;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float flagTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
float along = position.x / ${FLAG_LENGTH.toFixed(2)};
float wave = sin(position.x * 2.2 - flagTime * 4.0) * 0.28 + sin(position.x * 4.1 + position.y * 1.7 - flagTime * 6.3) * 0.08;
transformed.z += wave * along;
transformed.y -= along * along * 0.25;`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
float alongN = position.x / ${FLAG_LENGTH.toFixed(2)};
float slope = cos(position.x * 2.2 - flagTime * 4.0) * 0.28 * 2.2 * alongN;
objectNormal = normalize(vec3(-slope, 0.0, 1.0));`,
        );
    };
    material.customProgramCacheKey = () => "bandera-flameando";
    const flag = new THREE.Mesh(geometry, material);
    flag.castShadow = true;
    flag.position.set(0.08, POLE_HEIGHT - FLAG_HEIGHT / 2 - 0.3, 0);
    return { flag, time };
  }, []);

  useFrame((_, delta) => {
    time.value += Math.min(delta, 0.1);
  });

  return (
    <group position={position}>
      <mesh position={[0, POLE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.11, POLE_HEIGHT, 12]} />
        <meshStandardMaterial color="#d9dcdf" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, POLE_HEIGHT + 0.1, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 8]} />
        <meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.25} />
      </mesh>
      <primitive object={flag} />
    </group>
  );
}
