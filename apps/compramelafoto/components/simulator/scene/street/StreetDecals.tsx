"use client";

import type { GroundDecal, GroundDecalKind, StreetLayout, WallDecal, WallDecalKind } from "@/lib/simulator/street/street-layout";
import { seededRandom } from "@/lib/simulator/street/street-layout";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Detalles del piso y de las paredes: charcos que reflejan el cielo, hojas
 * secas, flores de jacarandá, parches de asfalto, manchas de aceite, una
 * rayuela de tiza, rejillas, flechas, un esténcil, grafitis y afiches.
 * Las texturas se dibujan en el navegador (no hay que bajar nada).
 */

type Painter = (g: CanvasRenderingContext2D, size: number, rand: () => number, variant: number) => void;

/** Borde irregular de una mancha (charco, parche, aceite). */
function blob(g: CanvasRenderingContext2D, size: number, rand: () => number, fill: string | CanvasGradient, roughness = 0.25) {
  const c = size / 2;
  const points = 26;
  const radii = Array.from({ length: points }, () => 0.62 + rand() * roughness);
  g.beginPath();
  for (let i = 0; i <= points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const r = radii[i % points] * c * 0.95;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r * 0.82;
    if (i === 0) g.moveTo(x, y);
    else g.quadraticCurveTo(c + Math.cos(a - 0.12) * r * 1.05, c + Math.sin(a - 0.12) * r * 0.86, x, y);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

const GROUND_PAINTERS: Record<GroundDecalKind, Painter> = {
  // Máscara del charco: blanco = agua. El color y el brillo los pone el material.
  puddle: (g, size, rand) => {
    g.filter = "blur(6px)";
    blob(g, size, rand, "#ffffff", 0.35);
    g.filter = "none";
  },
  leaves: (g, size, rand) => {
    const colors = ["#8a5a2b", "#a56b2e", "#6f4a24", "#b8863b", "#5e5130", "#94733d"];
    for (let i = 0; i < 160; i += 1) {
      const r = Math.sqrt(rand()) * size * 0.46;
      const a = rand() * Math.PI * 2;
      g.save();
      g.translate(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r);
      g.rotate(rand() * Math.PI * 2);
      g.fillStyle = colors[Math.floor(rand() * colors.length)];
      g.beginPath();
      g.ellipse(0, 0, 4 + rand() * 6, 2 + rand() * 3, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  },
  petals: (g, size, rand) => {
    const colors = ["#8f6fc8", "#a083d6", "#7a5bb5", "#b49be0"];
    for (let i = 0; i < 420; i += 1) {
      const r = Math.sqrt(rand()) * size * 0.47;
      const a = rand() * Math.PI * 2;
      g.fillStyle = colors[Math.floor(rand() * colors.length)];
      g.beginPath();
      g.ellipse(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, 2 + rand() * 2.5, 1.2 + rand() * 1.5, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  },
  patch: (g, size, rand) => {
    g.filter = "blur(1px)";
    blob(g, size, rand, "rgba(28,28,30,0.85)", 0.12);
    g.filter = "none";
    for (let i = 0; i < 300; i += 1) {
      g.fillStyle = `rgba(${60 + rand() * 40},${60 + rand() * 40},${60 + rand() * 40},0.5)`;
      g.fillRect(size * 0.2 + rand() * size * 0.6, size * 0.2 + rand() * size * 0.6, 2, 2);
    }
  },
  oil: (g, size, rand) => {
    const grad = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(10,10,12,0.7)");
    grad.addColorStop(0.6, "rgba(20,18,30,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    blob(g, size, rand, grad, 0.3);
  },
  // Rayuela: casillas del 1 al 8 y el CIELO arriba, con tiza.
  chalk: (g, size) => {
    const w = size / 3.2;
    const h = size / 10;
    g.strokeStyle = "rgba(245,245,240,0.9)";
    g.lineWidth = 4;
    g.font = `bold ${Math.round(h * 0.55)}px sans-serif`;
    g.fillStyle = "rgba(250,240,170,0.9)";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const cx = size / 2;
    const rows: [number, number][][] = [[[cx, 1]], [[cx, 2]], [[cx - w / 2, 3], [cx + w / 2, 4]], [[cx, 5]], [[cx - w / 2, 6], [cx + w / 2, 7]], [[cx, 8]]];
    rows.forEach((row, r) => {
      const y = size - (r + 1) * h * 1.25 - 10;
      for (const [x, n] of row) {
        g.strokeRect(x - w / 2, y - h / 2, w, h);
        g.fillText(String(n), x, y);
      }
    });
    g.beginPath();
    g.arc(cx, size - 7 * h * 1.25 - 10, w * 0.55, Math.PI, 0);
    g.stroke();
    g.fillText("CIELO", cx, size - 7 * h * 1.25 - 26);
  },
  drain: (g, size) => {
    g.fillStyle = "#2b2b2b";
    g.fillRect(size * 0.05, size * 0.25, size * 0.9, size * 0.5);
    g.fillStyle = "#0b0b0b";
    for (let x = size * 0.1; x < size * 0.9; x += size * 0.08) g.fillRect(x, size * 0.3, size * 0.04, size * 0.4);
  },
  arrow: (g, size) => {
    g.fillStyle = "rgba(233,231,224,0.92)";
    g.beginPath();
    g.moveTo(size * 0.5, size * 0.05);
    g.lineTo(size * 0.8, size * 0.32);
    g.lineTo(size * 0.6, size * 0.32);
    g.lineTo(size * 0.6, size * 0.95);
    g.lineTo(size * 0.4, size * 0.95);
    g.lineTo(size * 0.4, size * 0.32);
    g.lineTo(size * 0.2, size * 0.32);
    g.closePath();
    g.fill();
  },
  // Esténcil de un ojo (arte callejero).
  stencil: (g, size) => {
    g.fillStyle = "rgba(15,15,18,0.85)";
    g.beginPath();
    g.ellipse(size / 2, size / 2, size * 0.42, size * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(0,0,0,0)";
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.ellipse(size / 2, size / 2, size * 0.36, size * 0.17, 0, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgba(15,15,18,0.85)";
    g.beginPath();
    g.arc(size / 2, size / 2, size * 0.13, 0, Math.PI * 2);
    g.fill();
    g.font = `bold ${Math.round(size * 0.09)}px monospace`;
    g.textAlign = "center";
    g.fillText("MIRÁ", size / 2, size * 0.86);
  },
};

const TAGS = ["ROSARIO", "FOTO", "LUZ", "CALLE", "ARTE", "SUR", "NOCHE", "VOS"];
const POSTERS: [string, string, string][] = [
  ["RECITAL", "SÁB 22 HS", "#e5463b"],
  ["SE ALQUILA", "155-555", "#f4f1e8"],
  ["CLASES DE FOTO", "CAM OF DUTY", "#2f5d8c"],
  ["FERIA", "DOMINGO PLAZA", "#f3c844"],
  ["TANGO", "MILONGA", "#141414"],
  ["PERDIMOS A TOBY", "RECOMPENSA", "#ffffff"],
];

const WALL_PAINTERS: Record<WallDecalKind, (g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, variant: number) => void> = {
  graffiti: (g, w, h, rand, variant) => {
    const palettes = [["#ff3d7f", "#ffd23f", "#111"], ["#3dd6ff", "#7b2ff7", "#fff"], ["#56f06b", "#0b3d2e", "#fff"], ["#ff8c1a", "#2b2b2b", "#fff"], ["#f2f2f2", "#d7263d", "#111"], ["#ffe066", "#247ba0", "#111"]];
    const [fill, outline, shine] = palettes[variant % palettes.length];
    const word = TAGS[(variant * 3 + Math.floor(rand() * 4)) % TAGS.length];
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate((rand() - 0.5) * 0.18);
    g.font = `900 ${Math.round(h * 0.62)}px Impact, 'Arial Black', sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = h * 0.1;
    g.strokeStyle = outline;
    g.strokeText(word, 0, 0, w * 0.92);
    g.fillStyle = fill;
    g.fillText(word, 0, 0, w * 0.92);
    g.lineWidth = h * 0.02;
    g.strokeStyle = shine;
    g.strokeText(word, -h * 0.02, -h * 0.03, w * 0.92);
    g.restore();
    // Chorreados de pintura.
    g.fillStyle = fill;
    for (let i = 0; i < 7; i += 1) {
      const x = w * (0.15 + rand() * 0.7);
      g.fillRect(x, h * 0.62, 2 + rand() * 2, h * (0.1 + rand() * 0.3));
    }
  },
  poster: (g, w, h, _rand, variant) => {
    const [title, sub, color] = POSTERS[variant % POSTERS.length];
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    const dark = color === "#141414" || color === "#2f5d8c" || color === "#e5463b";
    g.fillStyle = dark ? "#fdfbf5" : "#141414";
    g.textAlign = "center";
    g.font = `900 ${Math.round(h * 0.12)}px Impact, 'Arial Black', sans-serif`;
    g.fillText(title, w / 2, h * 0.3, w * 0.9);
    g.font = `bold ${Math.round(h * 0.07)}px sans-serif`;
    g.fillText(sub, w / 2, h * 0.75, w * 0.9);
    // Esquina despegada.
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.moveTo(w, h * 0.85);
    g.lineTo(w * 0.85, h);
    g.lineTo(w, h);
    g.fill();
  },
};

function canvasTexture(width: number, height: number, paint: (g: CanvasRenderingContext2D) => void, color = true): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  paint(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

const VARIANTS = 4;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function groundMaterial(kind: GroundDecalKind, tex: THREE.Texture): THREE.Material {
  const common = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 };
  if (kind === "puddle") {
    // Agua: casi negra, lisa y brillante; refleja el cielo del entorno.
    return new THREE.MeshPhysicalMaterial({ ...common, color: "#0d1013", roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, alphaMap: tex, opacity: 0.92 });
  }
  if (kind === "patch") return new THREE.MeshStandardMaterial({ ...common, map: tex, roughness: 0.75 });
  if (kind === "oil") return new THREE.MeshPhysicalMaterial({ ...common, map: tex, roughness: 0.15, iridescence: 0.6, iridescenceIOR: 1.4 });
  return new THREE.MeshStandardMaterial({ ...common, map: tex, roughness: 0.85, alphaTest: 0.05 });
}

/** Una malla instanciada por tipo y variante, con todas las copias de la ciudad. */
function groundMeshes(decals: GroundDecal[]): THREE.InstancedMesh[] {
  const groups = new Map<string, GroundDecal[]>();
  for (const d of decals) {
    const key = `${d.kind}|${d.variant % VARIANTS}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const out: THREE.InstancedMesh[] = [];
  for (const [key, list] of groups) {
    const [kind, v] = key.split("|") as [GroundDecalKind, string];
    const variant = Number(v);
    const size = kind === "chalk" ? 512 : 256;
    const tex = canvasTexture(size, size, (g) => GROUND_PAINTERS[kind](g, size, seededRandom(variant * 97 + kind.length), variant), kind !== "puddle");
    const mesh = new THREE.InstancedMesh(geo, groundMaterial(kind, tex), list.length);
    list.forEach((d, i) => {
      _q.setFromAxisAngle(_up, d.rotationY);
      mesh.setMatrixAt(i, _m.compose(_p.set(d.position[0], d.position[1], d.position[2]), _q, _s.set(d.size[0], 1, d.size[1])));
    });
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    mesh.computeBoundingSphere();
    out.push(mesh);
  }
  return out;
}

function wallMeshes(decals: WallDecal[]): THREE.InstancedMesh[] {
  const groups = new Map<string, WallDecal[]>();
  for (const d of decals) {
    const key = `${d.kind}|${d.variant}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  const out: THREE.InstancedMesh[] = [];
  for (const [key, list] of groups) {
    const [kind, v] = key.split("|") as [WallDecalKind, string];
    const variant = Number(v);
    const w = kind === "graffiti" ? 512 : 256;
    const h = kind === "graffiti" ? 224 : 360;
    const tex = canvasTexture(w, h, (g) => WALL_PAINTERS[kind](g, w, h, seededRandom(variant * 31 + 7), variant));
    const material = new THREE.MeshStandardMaterial({ map: tex, transparent: kind === "graffiti", alphaTest: 0.05, roughness: kind === "graffiti" ? 0.6 : 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((d, i) => {
      _q.setFromAxisAngle(_up, d.rotationY);
      mesh.setMatrixAt(i, _m.compose(_p.set(d.position[0], d.position[1], d.position[2]), _q, _s.set(d.size[0], d.size[1], 1)));
    });
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    out.push(mesh);
  }
  return out;
}

/** Lo que queda a más de esto no se dibuja (son detalles para ver de cerca). */
const DRAW_DISTANCE = 120;

export default function StreetDecals({ layout }: { layout: StreetLayout }) {
  const camera = useThree((s) => s.camera);
  const meshes = useMemo(() => [...groundMeshes(layout.groundDecals), ...wallMeshes(layout.wallDecals)], [layout]);

  useEffect(
    () => () => {
      for (const m of meshes) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.map?.dispose();
        mat.alphaMap?.dispose();
        mat.dispose();
      }
    },
    [meshes],
  );

  // Las mallas abarcan toda la ciudad: se apagan las que quedan lejos (por su esfera).
  const tick = useRef(0);
  useFrame((_, delta) => {
    tick.current -= delta;
    if (tick.current > 0) return;
    tick.current = 0.3;
    for (const m of meshes) {
      const s = m.boundingSphere;
      if (!s) continue;
      m.visible = Math.hypot(s.center.x - camera.position.x, s.center.z - camera.position.z) - s.radius < DRAW_DISTANCE;
    }
  });

  return (
    <group name="calle-detalles">
      {meshes.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </group>
  );
}
