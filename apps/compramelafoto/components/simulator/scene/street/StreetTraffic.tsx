"use client";

import { simulatorRuntime, syncMovingSubjectsRegistry } from "@/lib/simulator/simulator-runtime";
import { STREET_CAR_ID_PREFIX as CAR_ID_PREFIX, type MovingSubjectState } from "@/lib/simulator/moving-subject-types";
import { STREET_MODELS } from "@/lib/simulator/street/street-assets";
import { streetRuntime } from "@/lib/simulator/street/street-runtime";
import { LANES, carPose, createTraffic, stepTraffic } from "@/lib/simulator/street/street-traffic";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Piezas de carrocería pintada (el resto: vidrios, gomas, interior, cromados). */
const BODY_PAINT = /^Body(RoofPanel|RearPanels|FrontPanels|Hood|Door(?!.*Mirror)|Fender|Bumper|.*Color1)/;

function paintCar(source: THREE.Object3D, paint: string): THREE.Object3D {
  const car = source.clone(true);
  // Pintura automotriz: base mate cubierta de laca brillante.
  const lacquer = new THREE.MeshPhysicalMaterial({
    color: paint,
    metalness: 0.4,
    roughness: 0.42,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  car.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (BODY_PAINT.test(mesh.name)) mesh.material = lacquer;
  });
  return car;
}

/** Faros y luces traseras: brillan de noche. */
function addLights(car: THREE.Object3D, head: THREE.Material, tail: THREE.Material) {
  const geo = new THREE.SphereGeometry(0.09, 10, 8);
  for (const side of [-0.62, 0.62]) {
    const f = new THREE.Mesh(geo, head);
    f.position.set(side, 0.72, 2.3);
    car.add(f);
    const t = new THREE.Mesh(geo, tail);
    t.position.set(side, 0.86, -1.88);
    car.add(t);
  }
}

/**
 * Autos circulando por la principal y la transversal. Frenan ante peatones,
 * respetan el PARE y entran y salen lejos, dentro de la bruma.
 */
export default function StreetTraffic() {
  const gltf = useGLTF(STREET_MODELS.carFar);
  const cars = useMemo(() => createTraffic(), []);
  const head = useMemo(() => new THREE.MeshStandardMaterial({ color: "#222", emissive: "#fff3dc", emissiveIntensity: 0 }), []);
  const tail = useMemo(() => new THREE.MeshStandardMaterial({ color: "#300", emissive: "#ff2a12", emissiveIntensity: 0 }), []);
  const objects = useMemo(
    () =>
      cars.map((c) => {
        const o = paintCar(gltf.scene, c.paint);
        addLights(o, head, tail);
        o.traverse((x) => {
          x.userData.codSubjectId = `${CAR_ID_PREFIX}${c.id}`;
        });
        return o;
      }),
    [cars, gltf.scene, head, tail],
  );

  const subjects = useMemo<MovingSubjectState[]>(
    () =>
      cars.map((c) => ({
        id: `${CAR_ID_PREFIX}${c.id}`,
        subjectKind: "vehicle",
        position: [0, 0.8, 0],
        speed: 0,
        direction: 1,
        velocityX: 0,
        visible: true,
      })),
    [cars],
  );

  useEffect(() => {
    // Se suman a los peatones ya registrados (AF-C y barrido los siguen igual).
    const others = simulatorRuntime.movingSubjects.filter((s) => !s.id.startsWith(CAR_ID_PREFIX));
    syncMovingSubjectsRegistry([...others, ...subjects]);
    return () => {
      syncMovingSubjectsRegistry(simulatorRuntime.movingSubjects.filter((s) => !s.id.startsWith(CAR_ID_PREFIX)));
    };
  }, [subjects]);

  useFrame((_, delta) => {
    stepTraffic(cars, streetRuntime.walkers, delta);
    const night = THREE.MathUtils.clamp((2 - simulatorRuntime.sunState.elevationDeg) / 8, 0, 1);
    (head as THREE.MeshStandardMaterial).emissiveIntensity = night * 30;
    (tail as THREE.MeshStandardMaterial).emissiveIntensity = night * 8;
    cars.forEach((c, i) => {
      const o = objects[i];
      o.visible = !c.parked;
      const pose = carPose(LANES[c.lane], c.s);
      o.position.set(pose.x, 0, pose.z);
      o.rotation.y = pose.heading;
      const s = subjects[i];
      s.position[0] = pose.x;
      s.position[2] = pose.z;
      s.speed = c.v;
      s.visible = !c.parked;
      s.velocity = [Math.sin(pose.heading) * c.v, 0, Math.cos(pose.heading) * c.v];
      s.velocityX = s.velocity[0];
    });
  });

  return (
    <group>
      {objects.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </group>
  );
}

useGLTF.preload(STREET_MODELS.carFar);
