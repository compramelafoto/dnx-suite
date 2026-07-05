"use client";

import { CITY_STREET } from "@/lib/simulator/scenes/city-scene";
import { Grid } from "@react-three/drei";
import MovingPedestrians from "./MovingPedestrians";
import MovingVehicles from "./MovingVehicles";

function Building({
  position,
  size,
  color,
  windowColor = "#ffe8c0",
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  windowColor?: string;
}) {
  const [w, h, d] = size;
  const rows = Math.max(2, Math.floor(h / 1.1));
  const cols = Math.max(2, Math.floor(w / 1.2));

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.06} />
      </mesh>
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const wx = -w / 2 + 0.65 + col * 1.15;
          const wy = 0.55 + row * 1.05;
          const wz = d / 2 + 0.02;
          return (
            <mesh key={`${row}-${col}`} position={[wx, wy, wz]}>
              <planeGeometry args={[0.55, 0.7]} />
              <meshStandardMaterial
                color={windowColor}
                emissive={windowColor}
                emissiveIntensity={0.35}
                roughness={0.2}
              />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 1.1, 8]} />
        <meshStandardMaterial color="#5a4030" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.75, 10, 10]} />
        <meshStandardMaterial color="#3d7a48" roughness={0.82} />
      </mesh>
    </group>
  );
}

function StreetLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.09, 4.5, 8]} />
        <meshStandardMaterial color="#3a3a42" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.35, 4.2, 0]}>
        <boxGeometry args={[0.7, 0.08, 0.08]} />
        <meshStandardMaterial color="#2a2a32" metalness={0.4} />
      </mesh>
      <pointLight
        position={[0.5, 4.1, 0]}
        intensity={0}
        distance={14}
        color="#ffcc88"
        userData={{ codStreetLight: true }}
      />
    </group>
  );
}

function Bench({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow position={[0, 0.28, 0]}>
        <boxGeometry args={[1.4, 0.08, 0.45]} />
        <meshStandardMaterial color="#6a5040" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 0.55, -0.18]}>
        <boxGeometry args={[1.4, 0.45, 0.06]} />
        <meshStandardMaterial color="#6a5040" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Sign({ position, textColor = "#f0f0f0" }: { position: [number, number, number]; textColor?: string }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2.8, 6]} />
        <meshStandardMaterial color="#555" metalness={0.5} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[1.2, 0.7, 0.06]} />
        <meshStandardMaterial color="#c0392b" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.2, 0.04]}>
        <planeGeometry args={[0.9, 0.35]} />
        <meshStandardMaterial color={textColor} />
      </mesh>
    </group>
  );
}

/**
 * Calle urbana fotorealista (PBR simplificado, bajo poly).
 * TODO: clima, tráfico avanzado, assets HDRI dedicados.
 */
export default function CityScene() {
  const halfStreet = CITY_STREET.width / 2;
  const sw = CITY_STREET.sidewalkWidth;

  return (
    <group>
      {/* Calzada */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[CITY_STREET.width, CITY_STREET.length]} />
        <meshStandardMaterial color="#2e3238" roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Veredas */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[side * (halfStreet + sw / 2), 0.02, 0]}
          receiveShadow
        >
          <planeGeometry args={[sw, CITY_STREET.length]} />
          <meshStandardMaterial color="#9a9590" roughness={0.88} />
        </mesh>
      ))}

      {/* Cordones */}
      {([-1, 1] as const).map((side) => (
        <mesh key={`kerb-${side}`} position={[side * halfStreet, 0.06, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.12, 0.12, CITY_STREET.length]} />
          <meshStandardMaterial color="#b8b4ae" roughness={0.8} />
        </mesh>
      ))}

      {/* Líneas viales */}
      {[-8, 0, 8].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, z]}>
          <planeGeometry args={[0.12, 3]} />
          <meshStandardMaterial color="#e8e4d8" />
        </mesh>
      ))}

      <Grid
        position={[0, 0.03, 0]}
        args={[CITY_STREET.width + sw * 2, CITY_STREET.length]}
        cellSize={2}
        cellThickness={0.4}
        sectionSize={8}
        sectionThickness={0.8}
        fadeDistance={50}
        fadeStrength={1.2}
        infiniteGrid={false}
      />

      {/* Edificios izquierda */}
      <Building position={[-11, 4, -18]} size={[7, 8, 10]} color="#8a9098" />
      <Building position={[-11, 5.5, -4]} size={[7, 11, 9]} color="#7a828c" windowColor="#fff0d0" />
      <Building position={[-11, 3.5, 12]} size={[7, 7, 8]} color="#949aa4" />
      <Building position={[-11, 6, 24]} size={[7, 12, 9]} color="#6a7280" />

      {/* Edificios derecha */}
      <Building position={[11, 4.5, -20]} size={[7, 9, 11]} color="#9a8a7a" />
      <Building position={[11, 5, -2]} size={[7, 10, 10]} color="#8a8078" />
      <Building position={[11, 3.8, 14]} size={[7, 7.6, 9]} color="#a09890" />
      <Building position={[11, 5.5, 26]} size={[7, 11, 8]} color="#787068" />

      {/* Árboles */}
      {[-6.5, 6.5].flatMap((x) =>
        [-16, -4, 8, 20].map((z) => <Tree key={`${x}-${z}`} position={[x, 0, z]} />),
      )}

      {/* Farolas */}
      {[-6.8, 6.8].flatMap((x) =>
        [-22, -10, 2, 14, 26].map((z) => <StreetLamp key={`lamp-${x}-${z}`} position={[x, 0, z]} />),
      )}

      <Bench position={[-6.3, 0, 6]} rotationY={Math.PI / 2} />
      <Bench position={[6.3, 0, -6]} rotationY={-Math.PI / 2} />

      <Sign position={[-5.5, 0, -12]} />
      <Sign position={[5.5, 0, 16]} textColor="#fff8e8" />

      {/* Señal PARE */}
      <group position={[4.2, 0, -18]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 2.8, 6]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[0.55, 0.55, 0.04]} />
          <meshStandardMaterial color="#c0392b" />
        </mesh>
      </group>

      <MovingVehicles />
      <MovingPedestrians />
    </group>
  );
}
