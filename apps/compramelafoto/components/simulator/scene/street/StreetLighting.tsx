"use client";

import { sunPositionFromState } from "@/lib/simulator/natural-light";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

/** El cielo es un cubo dentro del plano lejano de la cámara (120 m). */
const SKY_SCALE = 110;
/** Área de sombras alrededor del fotógrafo (m). */
const SHADOW_HALF = 38;
const SHADOW_MAP = 4096;

function skyParams(elevationDeg: number) {
  // Más turbidez cerca del horizonte: el atardecer se pone naranja.
  const low = THREE.MathUtils.clamp(1 - elevationDeg / 25, 0, 1);
  return {
    turbidity: 2.5 + low * 6,
    rayleigh: 1.2 + low * 1.8,
    mieCoefficient: 0.004 + low * 0.008,
    mieDirectionalG: 0.82,
  };
}

/**
 * Cielo, sol, luz ambiente y luna de la Calle 3D según la hora del día.
 * La luz ambiente sale del mismo cielo (mapa de entorno), así las sombras se
 * tiñen de azul a la tarde y los reflejos de los vidrios coinciden con el cielo.
 */
export default function StreetLighting() {
  const { gl, scene, camera } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const moonRef = useRef<THREE.DirectionalLight>(null);
  const glowRef = useRef<THREE.HemisphereLight>(null);
  const lastEnvMinutes = useRef<number | null>(null);

  const sky = useMemo(() => {
    const s = new Sky();
    s.scale.setScalar(SKY_SCALE);
    return s;
  }, []);

  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(10);
    envScene.add(envSky);
    return { pmrem, envScene, envSky, target: null as THREE.WebGLRenderTarget | null };
  }, [gl]);

  useEffect(() => {
    return () => {
      env.target?.dispose();
      env.pmrem.dispose();
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
      scene.environment = null;
    };
  }, [env, sky, scene]);

  const target = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const sunState = simulatorRuntime.sunState;
    const [px, py, pz] = sunPositionFromState(sunState);
    const sunDir = new THREE.Vector3(px, py, pz).normalize();
    const params = skyParams(sunState.elevationDeg);

    for (const s of [sky, env.envSky]) {
      const u = (s.material as THREE.ShaderMaterial).uniforms;
      u.turbidity.value = params.turbidity;
      u.rayleigh.value = params.rayleigh;
      u.mieCoefficient.value = params.mieCoefficient;
      u.mieDirectionalG.value = params.mieDirectionalG;
      u.sunPosition.value.copy(sunDir);
    }
    sky.position.copy(camera.position);

    // Regenerar el entorno cuesta: sólo cuando cambia la hora.
    if (lastEnvMinutes.current !== sunState.minutes) {
      lastEnvMinutes.current = sunState.minutes;
      env.target?.dispose();
      env.target = env.pmrem.fromScene(env.envScene, 0.02);
      scene.environment = env.target.texture;
    }
    // De noche el cielo casi no ilumina: mandan los faroles y las vidrieras.
    scene.environmentIntensity = 0.006 + 0.994 * THREE.MathUtils.smoothstep(sunState.elevationDeg, -8, 4);

    const sun = sunRef.current;
    if (sun) {
      const daylight = THREE.MathUtils.smoothstep(sunState.elevationDeg, -2, 6);
      // Iluminancia solar frente al cielo: el sol domina con el sol alto.
      sun.intensity = daylight * (1.2 + 2.6 * THREE.MathUtils.smoothstep(sunState.elevationDeg, 5, 45));
      sun.color.set(sunState.sunColor);
      sun.visible = sun.intensity > 0.01;
      // La sombra sigue al fotógrafo y se ajusta a la grilla de texels (no "nada").
      const texel = (SHADOW_HALF * 2) / SHADOW_MAP;
      const cx = Math.round(camera.position.x / texel) * texel;
      const cz = Math.round(camera.position.z / texel) * texel;
      target.position.set(cx, 0, cz);
      sun.position.set(cx + sunDir.x * 60, Math.max(4, sunDir.y * 60), cz + sunDir.z * 60);
      target.updateMatrixWorld();
    }

    const moon = moonRef.current;
    if (moon) {
      const night = 1 - THREE.MathUtils.smoothstep(sunState.elevationDeg, -6, 2);
      moon.intensity = night * 0.06;
      moon.visible = night > 0.01;
    }
    const glow = glowRef.current;
    if (glow) {
      // Resplandor urbano: el cielo de la ciudad nunca es negro (luz de sodio reflejada).
      const night = 1 - THREE.MathUtils.smoothstep(sunState.elevationDeg, -6, 2);
      glow.intensity = night * 0.35;
      glow.visible = night > 0.01;
    }
  });

  return (
    <>
      <primitive object={sky} />
      <primitive object={target} />
      <directionalLight
        ref={sunRef}
        target={target}
        castShadow
        shadow-mapSize-width={SHADOW_MAP}
        shadow-mapSize-height={SHADOW_MAP}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight ref={moonRef} position={[-30, 50, 20]} color="#9fb4e0" />
      <hemisphereLight ref={glowRef} args={["#5a4a3a", "#14110e", 0]} />
    </>
  );
}
