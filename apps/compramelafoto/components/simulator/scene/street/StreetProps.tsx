"use client";

import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { STREET_MODELS } from "@/lib/simulator/street/street-assets";
import { STREET_CARS, streetCarFor } from "@/lib/simulator/street/street-cars";
import type { PropKind, StreetLayout, StreetProp } from "@/lib/simulator/street/street-layout";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { cloneCar, useStreetCars } from "./street-car-models";

/** Los estacionados siguen la lista donde la dejan los 11 autos del tránsito. */
const PARKED_MODEL_OFFSET = 11;

/** Los autos estacionados se dibujan aparte (ParkedCars), con modelos variados. */
const MODEL_BY_KIND: Record<Exclude<PropKind, "car">, string> = {
  lamp: STREET_MODELS.lamp,
  tree: STREET_MODELS.tree,
  trash: STREET_MODELS.trash,
  hydrant: STREET_MODELS.hydrant,
  bench: STREET_MODELS.bench,
  utility: STREET_MODELS.utility,
  manhole: STREET_MODELS.manhole,
  plant: STREET_MODELS.plant,
  aircon: STREET_MODELS.aircon,
  "covered-car": STREET_MODELS.coveredCar,
};

/** Versión liviana para la distancia (THREE.LOD) y desde dónde se usa. */
const FAR_MODEL: Partial<Record<PropKind, { url: string; from: number }>> = {
  tree: { url: STREET_MODELS.treeFar, from: 25 },
};

/** Escala por tipo: el jacarandá de Poly Haven es un ejemplar adulto de parque. */
const SCALE_BY_KIND: Partial<Record<PropKind, number>> = { tree: 0.62 };

/** Luces reales encendidas a la vez (las demás sólo brillan): cuidan el rendimiento. */
const ACTIVE_LAMP_LIGHTS = 12;
/** Altura de la luminaria del farol (m). */
const LAMP_HEAD_HEIGHT = 5.6;

function cloneWithShadows(source: THREE.Object3D): THREE.Object3D {
  const copy = source.clone(true);
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return copy;
}

/** Autos estacionados: cada uno un modelo distinto de los que circulan. */
function ParkedCars({ items }: { items: StreetProp[] }) {
  const protos = useStreetCars();
  const objects = useMemo(
    () =>
      items.map((p, i) => {
        const o = cloneCar(protos[STREET_CARS.indexOf(streetCarFor(PARKED_MODEL_OFFSET + i))]);
        o.position.set(p.position[0], p.position[1], p.position[2]);
        o.rotation.y = p.rotationY;
        return o;
      }),
    [items, protos],
  );
  return (
    <>
      {objects.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </>
  );
}

function PropInstances({ kind, items }: { kind: Exclude<PropKind, "car">; items: StreetProp[] }) {
  const gltf = useGLTF(MODEL_BY_KIND[kind]);
  const far = FAR_MODEL[kind];
  const farGltf = useGLTF(far?.url ?? MODEL_BY_KIND[kind]);
  const objects = useMemo(
    () =>
      items.map((p) => {
        let o: THREE.Object3D = cloneWithShadows(gltf.scene);
        if (far) {
          // De lejos se dibuja la versión liviana: mismo aspecto, una fracción de triángulos.
          const lod = new THREE.LOD();
          lod.addLevel(o, 0);
          lod.addLevel(cloneWithShadows(farGltf.scene), far.from);
          o = lod;
        }
        o.position.set(p.position[0], p.position[1], p.position[2]);
        o.rotation.y = p.rotationY;
        o.scale.setScalar(SCALE_BY_KIND[kind] ?? 1);
        return o;
      }),
    [gltf.scene, farGltf.scene, far, items, kind],
  );
  return (
    <>
      {objects.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </>
  );
}

/** Luminarias: brillan de noche y las más cercanas iluminan con luz real. */
function LampLights({ lamps }: { lamps: StreetProp[] }) {
  const camera = useThree((s) => s.camera);
  const lights = useRef<(THREE.SpotLight | null)[]>([]);
  const targets = useMemo(
    () => Array.from({ length: ACTIVE_LAMP_LIGHTS }, () => new THREE.Object3D()),
    [],
  );
  const glow = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#2a2620", emissive: "#ffd7a0", emissiveIntensity: 0 }),
    [],
  );
  const heads = useMemo(
    () =>
      lamps.map((l) => ({
        x: l.position[0] - Math.sign(l.position[0]) * 1.1,
        z: l.position[2],
      })),
    [lamps],
  );

  useFrame(() => {
    const night = THREE.MathUtils.clamp((2 - simulatorRuntime.sunState.elevationDeg) / 8, 0, 1);
    glow.emissiveIntensity = night * 40;
    const nearest = heads
      .map((h, i) => ({ i, d: (h.x - camera.position.x) ** 2 + (h.z - camera.position.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.min(ACTIVE_LAMP_LIGHTS, simulatorRuntime.quality.lampLights));
    lights.current.forEach((light, slot) => {
      if (!light) return;
      const pick = nearest[slot];
      if (!pick || night < 0.01) {
        light.visible = false;
        return;
      }
      const h = heads[pick.i];
      light.visible = true;
      light.position.set(h.x, LAMP_HEAD_HEIGHT - 0.2, h.z);
      // La luminaria apunta al piso: deja una pileta de luz en la vereda y la calle.
      targets[slot].position.set(h.x, 0, h.z);
      targets[slot].updateMatrixWorld();
      light.intensity = night * 520;
    });
  });

  return (
    <>
      {heads.map((h, i) => (
        <mesh key={i} position={[h.x, LAMP_HEAD_HEIGHT, h.z]} material={glow}>
          <sphereGeometry args={[0.16, 12, 8]} />
        </mesh>
      ))}
      {targets.map((t, i) => (
        <group key={i}>
          <primitive object={t} />
          <spotLight
            ref={(el) => {
              lights.current[i] = el;
            }}
            target={t}
            color="#ffcf94"
            angle={1.05}
            penumbra={0.8}
            distance={26}
            decay={2}
          />
        </group>
      ))}
    </>
  );
}

export default function StreetProps({ layout }: { layout: StreetLayout }) {
  const byKind = useMemo(() => {
    const map = new Map<PropKind, StreetProp[]>();
    for (const p of layout.props) map.set(p.kind, [...(map.get(p.kind) ?? []), p]);
    return [...map.entries()];
  }, [layout]);
  const lamps = useMemo(() => layout.props.filter((p) => p.kind === "lamp"), [layout]);

  return (
    <group>
      {byKind.map(([kind, items]) =>
        kind === "car" ? <ParkedCars key={kind} items={items} /> : <PropInstances key={kind} kind={kind} items={items} />,
      )}
      <LampLights lamps={lamps} />
    </group>
  );
}

for (const url of Object.values(MODEL_BY_KIND)) useGLTF.preload(url);
