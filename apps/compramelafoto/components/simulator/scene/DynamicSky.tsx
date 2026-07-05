"use client";

import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Cielo procedural con gradiente según hora del día.
 * TODO: nubes, clima, HDRI por estación.
 */
export default function DynamicSky() {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color("#6eb5ff") },
        bottomColor: { value: new THREE.Color("#d8e8ff") },
        offset: { value: 0.25 },
        exponent: { value: 0.65 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float t = pow(max(h + offset, 0.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
  }, []);

  useFrame(() => {
    const sun = simulatorRuntime.sunState;
    const top = material.uniforms.topColor.value as THREE.Color;
    const bottom = material.uniforms.bottomColor.value as THREE.Color;
    top.set(sun.skyColor);
    bottom.set(sun.fogColor);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} scale={120} material={material}>
      <sphereGeometry args={[1, 24, 16]} />
    </mesh>
  );
}
