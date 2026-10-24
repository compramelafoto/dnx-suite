"use client";

import { sunPositionFromState } from "@/lib/simulator/natural-light";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { WEATHER_LOOKS, weatherStore } from "@/lib/simulator/weather";
import { setGroundWetness } from "./wet-ground";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

/** El cielo es un cubo dentro del plano lejano de la cámara (220 m). */
const SKY_SCALE = 200;
/**
 * Cielo cubierto (nublado o lluvia): una cúpula gris por delante del cielo
 * despejado. Brillo relativo al sol pleno; calibrado para que el fotómetro
 * marque ~3 pasos menos nublado y ~4 con lluvia (la regla del "sol 16").
 */
const OVERCAST_SKY = { cloudy: 1.15, rain: 0.38 } as const;
const OVERCAST_COLOR = new THREE.Color("#b9c0c8");
/**
 * El mapa de sombras del sol se rehace uno de cada tantos cuadros: costaba
 * ~24 ms por cuadro (toda la ciudad dibujada de nuevo desde el sol). El sol
 * casi no se mueve y three.js guarda con el mapa desde dónde se sacó, así que
 * la sombra sigue en su lugar; la de quien camina llega un cuadro tarde.
 */
const SHADOW_EVERY_FRAMES = 2;
/** Área de sombras alrededor del fotógrafo (m). */
const SHADOW_HALF = 38;
const SHADOW_MAP = 4096;

/** Cúpula del cielo cubierto (una para la vista y otra para el mapa de entorno). */
function makeDome(radius: number): THREE.Mesh {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16),
    new THREE.MeshBasicMaterial({ color: OVERCAST_COLOR, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }),
  );
  dome.renderOrder = -1;
  dome.visible = false;
  return dome;
}

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

  const dome = useMemo(() => makeDome(SKY_SCALE * 0.45), []);

  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(10);
    envScene.add(envSky);
    const envDome = makeDome(4);
    envScene.add(envDome);
    return { pmrem, envScene, envSky, envDome, target: null as THREE.WebGLRenderTarget | null };
  }, [gl]);

  const fog = useMemo(() => new THREE.Fog("#a8c8e8", WEATHER_LOOKS.sunny.fogNear, WEATHER_LOOKS.sunny.fogFar), []);
  const fogColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
      env.target?.dispose();
      env.pmrem.dispose();
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
      scene.environment = null;
    };
  }, [env, sky, scene, fog]);

  const target = useMemo(() => new THREE.Object3D(), []);
  const shadowFrame = useRef(0);

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useFrame(() => {
    // Durante la toma se rehace siempre: la foto tiene que salir exacta.
    shadowFrame.current = (shadowFrame.current + 1) % SHADOW_EVERY_FRAMES;
    if (shadowFrame.current === 0 || simulatorRuntime.captureActive) gl.shadowMap.needsUpdate = true;
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
    dome.position.copy(camera.position);

    // Clima: cielo cubierto, bruma y piso mojado.
    const weather = weatherStore.get();
    const look = WEATHER_LOOKS[weather];
    const dayLight = THREE.MathUtils.smoothstep(sunState.elevationDeg, -8, 12);
    const overcastLevel = weather === "sunny" ? 0 : OVERCAST_SKY[weather] * (0.01 + 0.99 * dayLight);
    for (const d of [dome, env.envDome]) {
      d.visible = look.overcast > 0;
      const m = d.material as THREE.MeshBasicMaterial;
      m.opacity = look.overcast;
      m.color.copy(OVERCAST_COLOR).multiplyScalar(overcastLevel);
    }
    fog.near = look.fogNear;
    fog.far = look.fogFar;
    setGroundWetness(look.wet);

    // Regenerar el entorno cuesta: sólo cuando cambia la hora o el clima.
    const envKey = sunState.minutes * 10 + ["sunny", "cloudy", "rain"].indexOf(weather);
    if (lastEnvMinutes.current !== envKey) {
      lastEnvMinutes.current = envKey;
      env.target?.dispose();
      env.target = env.pmrem.fromScene(env.envScene, 0.02);
      scene.environment = env.target.texture;
    }
    // La bruma toma el color del horizonte, con el brillo de la luz del momento.
    const dayFactor = THREE.MathUtils.smoothstep(sunState.elevationDeg, -6, 10);
    fogColor.set(sunState.fogColor).multiplyScalar(0.02 + 0.9 * dayFactor);
    // Con el cielo cubierto el horizonte es gris (sin cambiar cuánto se ve a lo lejos).
    if (look.overcast > 0) fogColor.lerp(OVERCAST_COLOR.clone().multiplyScalar(overcastLevel * 0.55), look.overcast);
    fog.color.copy(fogColor);

    // De noche el cielo casi no ilumina: mandan los faroles y las vidrieras.
    scene.environmentIntensity = (0.006 + 0.994 * THREE.MathUtils.smoothstep(sunState.elevationDeg, -8, 4)) * (look.overcast > 0 ? 1 : look.sky);

    const sun = sunRef.current;
    // El tamaño del mapa de sombras sigue la calidad vigente (se rehace al cambiar).
    const wanted = simulatorRuntime.quality.shadowMapSize;
    if (sun && sun.shadow.mapSize.x !== wanted) {
      sun.shadow.mapSize.set(wanted, wanted);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    if (sun) {
      const daylight = THREE.MathUtils.smoothstep(sunState.elevationDeg, -2, 6);
      // Iluminancia solar frente al cielo: el sol domina con el sol alto.
      sun.intensity = daylight * (1.2 + 2.6 * THREE.MathUtils.smoothstep(sunState.elevationDeg, 5, 45)) * look.sun;
      sun.color.set(sunState.sunColor);
      sun.visible = sun.intensity > 0.01;
      // La sombra sigue al fotógrafo y se ajusta a la grilla de texels (no "nada").
      const texel = (SHADOW_HALF * 2) / sun.shadow.mapSize.x;
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
      <primitive object={dome} />
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
