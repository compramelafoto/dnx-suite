"use client";

import { WEATHER_LOOKS, weatherStore } from "@/lib/simulator/weather";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { isTouchGameDevice } from "@/lib/simulator/touch-input";

/** Gotas alrededor del fotógrafo (las de más lejos ya no se distinguen). */
const DROPS = 4500;
/** Celular: la mitad de gotas (igual se ve llover y pesa menos). */
const MOBILE_DROPS = 2200;
const BOX = { x: 36, y: 18, z: 36 };
/** Velocidad de caída de una gota de lluvia (m/s) y largo del trazo que deja en un cuadro. */
const FALL = 9;
const STREAK = 0.35;
/** Viento: las gotas caen un poco inclinadas. */
const WIND = new THREE.Vector3(0.9, 0, 0.4);

/**
 * Lluvia: trazos que caen alrededor de la cámara y se reciclan arriba. Con
 * tiempos de exposición largos la cámara los suma en rayas; con cortos quedan
 * como gotas congeladas.
 */
export default function StreetRain() {
  const camera = useThree((s) => s.camera);
  const { lines, drops, positions, count } = useMemo(() => {
    const count = isTouchGameDevice() ? MOBILE_DROPS : DROPS;
    const drops = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      drops[i * 3] = (Math.random() - 0.5) * BOX.x;
      drops[i * 3 + 1] = Math.random() * BOX.y;
      drops[i * 3 + 2] = (Math.random() - 0.5) * BOX.z;
    }
    const positions = new Float32Array(count * 6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.LineBasicMaterial({ color: "#c8d4e0", transparent: true, opacity: 0.45, depthWrite: false });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    lines.renderOrder = 2;
    return { lines, drops, positions, count };
  }, []);

  useFrame((_, delta) => {
    const look = WEATHER_LOOKS[weatherStore.get()];
    lines.visible = look.rain > 0;
    if (!lines.visible) return;
    const dt = Math.min(delta, 0.1);
    const dir = new THREE.Vector3(WIND.x, -FALL, WIND.z);
    const step = dir.clone().multiplyScalar(dt);
    const tail = dir.clone().normalize().multiplyScalar(-STREAK);
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (let i = 0; i < count; i += 1) {
      let x = drops[i * 3] + step.x;
      let y = drops[i * 3 + 1] + step.y;
      let z = drops[i * 3 + 2] + step.z;
      if (y < 0) {
        y += BOX.y;
        x = (Math.random() - 0.5) * BOX.x;
        z = (Math.random() - 0.5) * BOX.z;
      }
      // La caja sigue al fotógrafo: las gotas quedan en coordenadas relativas.
      if (x > BOX.x / 2) x -= BOX.x;
      if (x < -BOX.x / 2) x += BOX.x;
      if (z > BOX.z / 2) z -= BOX.z;
      if (z < -BOX.z / 2) z += BOX.z;
      drops[i * 3] = x;
      drops[i * 3 + 1] = y;
      drops[i * 3 + 2] = z;
      const o = i * 6;
      positions[o] = cx + x;
      positions[o + 1] = y;
      positions[o + 2] = cz + z;
      positions[o + 3] = cx + x + tail.x;
      positions[o + 4] = y + tail.y;
      positions[o + 5] = cz + z + tail.z;
    }
    lines.geometry.attributes.position.needsUpdate = true;
  });

  return <primitive object={lines} />;
}
