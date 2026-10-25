"use client";

import { simulatorRuntime, syncMovingSubjectsRegistry } from "@/lib/simulator/simulator-runtime";
import { STREET_CAR_ID_PREFIX as CAR_ID_PREFIX, type MovingSubjectState } from "@/lib/simulator/moving-subject-types";
import { streetRuntime } from "@/lib/simulator/street/street-runtime";
import { LANES, carPose, createTraffic, stepTraffic } from "@/lib/simulator/street/street-traffic";
import { STREET_RIDES, crankRadiansPerMeter } from "@/lib/simulator/street/street-rides";
import { STREET_FIGURES, figureForDevice } from "@/lib/simulator/street/street-people";
import { figureById } from "@/lib/simulator/studio-light/figures";
import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { cloneCar, useStreetCars, useStreetRides, type StreetCarPrototype } from "./street-car-models";
import { avatarUrl, instantiateAvatar, prepareAvatarLoader } from "./street-avatar";
import { mountRider, pedal, type Rider } from "./rider-pose";
import { isTouchGameDevice } from "@/lib/simulator/touch-input";

const LAMP = new THREE.SphereGeometry(0.07, 10, 8);
/** Más allá de esto los autos que circulan no se dibujan. */
const DRAW_DISTANCE = 140;
/** Bicis y motos (con su persona arriba): más cerca, como los peatones. */
const RIDE_DRAW_DISTANCE = 85;
const MOBILE_DRAW_SCALE = 0.65;
/** Más cerca que esto se ve pedalear. */
const PEDAL_DISTANCE = 45;
// En el celular, las mismas cuatro personas que caminan (menos para bajar).
const RIDER_SPECS = STREET_FIGURES.map((id) => figureById(figureForDevice(id, isTouchGameDevice()))!);

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
  const rideProtos = useStreetRides();
  // Los mismos avatares que los peatones (el cargador los comparte).
  const riderSources = useLoader(FBXLoader, RIDER_SPECS.map(avatarUrl), prepareAvatarLoader) as THREE.Group[];
  // En el celular, dos de cada tres vehículos en movimiento (los estacionados quedan todos).
  const cars = useMemo(() => {
    const all = createTraffic();
    return isTouchGameDevice() ? all.filter((car, i) => car.parked || i % 3 !== 2) : all;
  }, []);
  const head = useMemo(() => new THREE.MeshStandardMaterial({ color: "#222", emissive: "#fff3dc", emissiveIntensity: 0 }), []);
  const tail = useMemo(() => new THREE.MeshStandardMaterial({ color: "#300", emissive: "#ff2a12", emissiveIntensity: 0 }), []);
  const { objects, riders } = useMemo(() => {
    const avatarCache = new Map<string, THREE.Material>();
    const riders: (Rider | null)[] = [];
    let n = 0;
    const objects = cars.map((c) => {
      const id = `${CAR_ID_PREFIX}${c.id}`;
      if (c.ride !== null) {
        const o = cloneCar(rideProtos[c.ride]);
        const k = (n * 5 + 2) % RIDER_SPECS.length;
        n += 1;
        const { root } = instantiateAvatar(riderSources[k], RIDER_SPECS[k], avatarCache, id);
        riders.push(mountRider(o, root, STREET_RIDES[c.ride]));
        o.traverse((x) => {
          x.userData.codSubjectId = id;
        });
        return o;
      }
      const o = cloneCar(protos[c.model]);
      addLights(o, protos[c.model], head, tail);
      o.traverse((x) => {
        x.userData.codSubjectId = id;
      });
      riders.push(null);
      return o;
    });
    return { objects, riders };
  }, [cars, protos, rideProtos, riderSources, head, tail]);

  const subjects = useMemo<MovingSubjectState[]>(
    () =>
      cars.map((c) => ({
        id: `${CAR_ID_PREFIX}${c.id}`,
        subjectKind: "vehicle",
        // En las bicis y motos, el autofoco apunta a la persona.
        position: [0, c.ride !== null ? 1.15 : 0.8, 0],
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

  useFrame(({ camera }, delta) => {
    stepTraffic(cars, streetRuntime.walkers, delta);
    const night = THREE.MathUtils.clamp((2 - simulatorRuntime.sunState.elevationDeg) / 8, 0, 1);
    (head as THREE.MeshStandardMaterial).emissiveIntensity = night * 30;
    (tail as THREE.MeshStandardMaterial).emissiveIntensity = night * 8;
    // De día no se dibujan: los faros del propio modelo ya se ven.
    head.visible = tail.visible = night > 0.01;
    const dt = Math.min(delta, 0.1);
    cars.forEach((c, i) => {
      const o = objects[i];
      const pose = carPose(LANES[c.lane], c.s);
      const dist = Math.hypot(pose.x - camera.position.x, pose.z - camera.position.z);
      const rider = riders[i];
      // Lejos (en la bruma) no se dibuja: la ciudad tiene muchos autos.
      // En el celular se cortan antes (cada auto son varias llamadas de dibujo).
      const k = simulatorRuntime.quality.mobile ? MOBILE_DRAW_SCALE : 1;
      o.visible = !c.parked && dist < (rider ? RIDE_DRAW_DISTANCE : DRAW_DISTANCE) * k;
      o.position.set(pose.x, 0, pose.z);
      o.rotation.y = pose.heading;
      if (rider && o.visible && dist < PEDAL_DISTANCE) pedal(rider, c.v * dt, crankRadiansPerMeter(rider.ride));
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
    <group name="calle-transito">
      {objects.map((o) => (
        <primitive key={o.uuid} object={o} />
      ))}
    </group>
  );
}
