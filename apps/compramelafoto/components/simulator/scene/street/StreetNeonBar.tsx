"use client";

import { STREET, type NeonBar } from "@/lib/simulator/street/street-layout";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const PINK = "#ff2a8a";
const CYAN = "#19e3ff";
const WARM = "#ffb067";
/** Brillo de los tubos y del cartel (más que la luz de la escena: con tiempos largos se queman). */
const NEON_GLOW = 9;
/** El cartel, menos: con el halo pintado en la textura se empastaba y no se leía. */
const SIGN_GLOW = 2.2;
const INTERIOR_GLOW = 2.6;
/** Luces reales del bar (candelas aprox.): de noche mandan en el pasaje. */
const SIGN_LIGHT = 32;
const WINDOW_LIGHT = 60;
/** Más lejos que esto las luces se apagan (no se ve su efecto y ahorran cálculo). */
const LIGHTS_RANGE = 60;

const FRONT_HEIGHT = 4;
const WINDOW = { width: 3.6, height: 1.9, bottom: 0.7, center: -1.2 };
const DOOR = { width: 1.1, height: 2.3, center: 2.3 };

/** Interior visto desde la vereda: luz cálida, estantes con botellas, barra y lamparitas colgando. */
function interiorTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 270;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#5a2c14");
  bg.addColorStop(0.55, "#c9772f");
  bg.addColorStop(1, "#3a1d0e");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // Estantes con botellas.
  for (const y of [70, 125]) {
    g.fillStyle = "#2b160a";
    g.fillRect(20, y, w - 40, 6);
    for (let x = 30; x < w - 30; x += 14 + ((x * 7) % 9)) {
      const bh = 26 + ((x * 13) % 18);
      g.fillStyle = ["#1d4d2c", "#5b1f1a", "#d8b26a", "#2a2f4a", "#8a5a20"][x % 5];
      g.fillRect(x, y - bh, 8, bh);
      g.fillRect(x + 2, y - bh - 8, 4, 8);
    }
  }
  // Lamparitas colgando.
  for (let x = 60; x < w; x += 110) {
    g.strokeStyle = "#1a0d06";
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 28);
    g.stroke();
    const glow = g.createRadialGradient(x, 34, 1, x, 34, 26);
    glow.addColorStop(0, "#fff4cf");
    glow.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = glow;
    g.fillRect(x - 26, 8, 52, 52);
  }
  // Barra con gente acodada (siluetas).
  g.fillStyle = "#22110a";
  g.fillRect(0, 190, w, 80);
  g.fillStyle = "#4a2612";
  g.fillRect(0, 186, w, 8);
  for (const [x, s] of [
    [120, 1],
    [300, 0.9],
    [410, 1.1],
  ] as const) {
    g.fillStyle = "#140a05";
    g.beginPath();
    g.arc(x, 150 - 10 * s, 16 * s, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - 24 * s, 168 - 10 * s, 48 * s, 40);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Cartel de neón: "BAR" en rosa y "PASAJE" en celeste, con su halo. */
function signTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 384;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const neon = (text: string, y: number, size: number, color: string) => {
    g.font = `italic 700 ${size}px "Brush Script MT", "Segoe Script", cursive`;
    g.strokeStyle = color;
    g.shadowColor = color;
    for (const [blur, width] of [
      [40, size * 0.09],
      [16, size * 0.06],
    ]) {
      g.shadowBlur = blur;
      g.lineWidth = width;
      g.strokeText(text, w / 2, y);
    }
    // Centro del tubo casi blanco, como el neón de verdad.
    g.shadowBlur = 0;
    g.strokeStyle = "#ffffff";
    g.lineWidth = size * 0.022;
    g.strokeText(text, w / 2, y);
  };
  neon("Bar", 150, 220, PINK);
  neon("PASAJE", 305, 96, CYAN);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tubo de neón por un recorrido cerrado (marco de la vidriera). */
function neonTube(points: THREE.Vector3[], color: string, closed = true): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, closed, "catmullrom", 0.02);
  const geometry = new THREE.TubeGeometry(curve, points.length * 12, 0.022, 6, closed);
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(NEON_GLOW) });
  return new THREE.Mesh(geometry, material);
}

/**
 * Bar con luces de neón en el pasaje: frente oscuro, vidriera y puerta con luz
 * cálida, cartel y tubos de neón, y dos luces reales (rosa y cálida) que de noche
 * pintan el piso, las paredes y a quien se pare enfrente. Sirve para practicar
 * cómo el tiempo de exposición sube la luz ambiente y el diafragma, la del flash.
 */
export default function StreetNeonBar({ bar }: { bar: NeonBar }) {
  const camera = useThree((s) => s.camera);
  const signLight = useRef<THREE.PointLight>(null);
  const windowLight = useRef<THREE.PointLight>(null);

  const parts = useMemo(() => {
    const interior = interiorTexture();
    const interiorMat = new THREE.MeshBasicMaterial({ map: interior, color: new THREE.Color(INTERIOR_GLOW, INTERIOR_GLOW, INTERIOR_GLOW) });
    const signMat = new THREE.MeshBasicMaterial({
      map: signTexture(),
      color: new THREE.Color(SIGN_GLOW, SIGN_GLOW, SIGN_GLOW),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const frontMat = new THREE.MeshStandardMaterial({ color: "#1c2724", roughness: 0.55, metalness: 0.2 });
    const z = 0.075;
    const wb = WINDOW.bottom;
    const wt = WINDOW.bottom + WINDOW.height;
    const wl = WINDOW.center - WINDOW.width / 2 - 0.12;
    const wr = WINDOW.center + WINDOW.width / 2 + 0.12;
    const frame = neonTube(
      [new THREE.Vector3(wl, wb - 0.12, z + 0.04), new THREE.Vector3(wr, wb - 0.12, z + 0.04), new THREE.Vector3(wr, wt + 0.12, z + 0.04), new THREE.Vector3(wl, wt + 0.12, z + 0.04)],
      CYAN,
    );
    // Flecha rosa que señala la puerta.
    const arrow = neonTube(
      [new THREE.Vector3(DOOR.center - 0.9, 2.9, z + 0.04), new THREE.Vector3(DOOR.center - 0.1, 2.9, z + 0.04), new THREE.Vector3(DOOR.center - 0.3, 3.08, z + 0.04)],
      PINK,
      false,
    );
    return { interior, interiorMat, signMat, frontMat, frame, arrow };
  }, []);

  const [nx, nz] = bar.normal;
  const rotationY = Math.atan2(nx, nz);
  const position: [number, number, number] = [bar.center[0], STREET.curbHeight, bar.center[1]];
  const worldPos = useMemo(() => new THREE.Vector3(...position), [position[0], position[2]]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const near = camera.position.distanceTo(worldPos) < LIGHTS_RANGE;
    if (signLight.current) signLight.current.intensity = near ? SIGN_LIGHT : 0;
    if (windowLight.current) windowLight.current.intensity = near ? WINDOW_LIGHT : 0;
  });

  return (
    <group name="calle-bar-neon" position={position} rotation={[0, rotationY, 0]}>
      {/* Frente pintado de verde oscuro sobre la medianera. */}
      <mesh position={[0, FRONT_HEIGHT / 2, 0.03]} material={parts.frontMat} receiveShadow>
        <boxGeometry args={[bar.width, FRONT_HEIGHT, 0.06]} />
      </mesh>
      <mesh position={[WINDOW.center, WINDOW.bottom + WINDOW.height / 2, 0.065]} material={parts.interiorMat}>
        <planeGeometry args={[WINDOW.width, WINDOW.height]} />
      </mesh>
      <mesh position={[DOOR.center, DOOR.height / 2, 0.065]} material={parts.interiorMat}>
        <planeGeometry args={[DOOR.width, DOOR.height]} />
      </mesh>
      <mesh position={[-1.2, 3.32, 0.09]} material={parts.signMat}>
        <planeGeometry args={[2.95, 1.1]} />
      </mesh>
      <primitive object={parts.frame} />
      <primitive object={parts.arrow} />
      <pointLight ref={signLight} position={[-1.2, 3.0, 1.0]} color={PINK} distance={16} decay={2} intensity={0} />
      <pointLight ref={windowLight} position={[WINDOW.center + 0.8, 1.6, 1.3]} color={WARM} distance={14} decay={2} intensity={0} />
    </group>
  );
}
