"use client";

import { simulatorRuntime, syncMovingSubjectsRegistry } from "@/lib/simulator/simulator-runtime";
import { STREET_CAR_ID_PREFIX as CAR_ID_PREFIX, type MovingSubjectState } from "@/lib/simulator/moving-subject-types";
import { streetRuntime } from "@/lib/simulator/street/street-runtime";
import { LANES, carPose, createTraffic, stepTraffic } from "@/lib/simulator/street/street-traffic";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { cloneCar, useStreetCars, type StreetCarPrototype } from "./street-car-models";

const LAMP = new THREE.SphereGeometry(0.07, 10, 8);

/** Faros y luces traseras (brillan de noche), en las puntas de cada modelo. */
function addLights(car: THREE.Object3D, proto: StreetCarPrototype, head: THREE.Material, tail: THREE.Material) {
  const half = proto.model.lengthM / 2;
  const side = proto.width * 0.34;
  for (const x of [-side, side]) {
    const f = new THREE.Mesh(LAMP, head);
    f.position.set(x, 0.66, half - 0.12);
    car.add(f);
    const t = new THREE.Mesh(LAMP, tail);
    t.position.set(x, 0.85, -half + 0.1);
    car.add(t);
  }
}

/**
 * Autos circulando por la principal y la transversal. Frenan ante peatones,
 * respetan el PARE y entran y salen lejos, dentro de la bruma.
 */
export default function StreetTraffic() {
  const protos = useStreetCars();
  const cars = useMemo(() => createTraffic(), []);
  const head = useMemo(() => new THREE.MeshStandardMaterial({ color: "#222", emissive: "#fff3dc", emissiveIntensity: 0 }), []);
  const tail = useMemo(() => new THREE.MeshStandardMaterial({ color: "#300", emissive: "#ff2a12", emissiveIntensity: 0 }), []);
  const objects = useMemo(
    () =>
      cars.map((c) => {
        const o = cloneCar(protos[c.model]);
        addLights(o, protos[c.model], head, tail);
        o.traverse((x) => {
          x.userData.codSubjectId = `${CAR_ID_PREFIX}${c.id}`;
        });
        return o;
      }),
    [cars, protos, head, tail],
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
    // De día no se dibujan: los faros del propio modelo ya se ven.
    head.visible = tail.visible = night > 0.01;
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
