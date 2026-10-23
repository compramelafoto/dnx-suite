import assert from "node:assert/strict";
import { test } from "node:test";

import { STREET } from "./street-layout";
import { LANES, carPose, createTraffic, stepTraffic, type TrafficCar } from "./street-traffic";

function run(cars: TrafficCar[], seconds: number, walkers: [number, number][] = [], onStep?: () => void) {
  for (let t = 0; t < seconds; t += 0.05) {
    stepTraffic(cars, walkers, 0.05);
    onStep?.();
  }
}

function car(lane: number, s: number, v: number, v0 = Math.max(v, 8)): TrafficCar {
  return { id: `t${lane}`, lane, s, v, v0, length: 4.4, stoppedFor: 0, clearedStop: false, parked: false, paint: "#fff" };
}

test("los autos nunca se chocan entre sí en 5 minutos de tránsito", () => {
  const cars = createTraffic();
  run(cars, 300, [], () => {
    for (const a of cars) {
      for (const b of cars) {
        if (a === b || a.parked || b.parked || a.lane !== b.lane) continue;
        assert.ok(Math.abs(a.s - b.s) >= a.length - 0.05, `${a.id} y ${b.id}`);
      }
    }
  });
});

test("un auto frena ante un peatón en la senda y sigue cuando pasa", () => {
  const lane = LANES[0];
  const c = car(0, 40, 10);
  const cars = [c];
  const crosswalkZ = -(STREET.roadHalf + STREET.sidewalk / 2);
  run(cars, 15, [[lane.offset, crosswalkZ]]);
  const front = carPose(lane, c.s).z + c.length / 2;
  assert.ok(c.v < 0.2, `velocidad ${c.v}`);
  assert.ok(front < crosswalkZ - 0.5, `frente en ${front}`);
  run(cars, 5, []);
  assert.ok(c.v > 3, "arranca cuando el peatón pasó");
});

test("en la transversal se detiene en el PARE y después cruza", () => {
  const lane = LANES[2];
  const c = car(2, 30, 8);
  const cars = [c];
  let xAtStop: number | null = null;
  let crossed = false;
  for (let t = 0; t < 30; t += 0.05) {
    stepTraffic(cars, [], 0.05);
    if (xAtStop === null && c.v < 0.3 && !c.parked) xAtStop = carPose(lane, c.s).x;
    if (carPose(lane, c.s).x < -10) crossed = true;
  }
  assert.ok(crossed, "cruzó la esquina");
  assert.ok(xAtStop !== null, "se detuvo");
  assert.ok(xAtStop - c.length / 2 > STREET.roadHalf + STREET.sidewalk, `frenó en x=${xAtStop}`);
});

test("la transversal espera si viene un auto por la principal", () => {
  // El de la transversal ya está parado en el PARE; por la principal viene otro a 10 m de la esquina.
  const cross = car(2, 55.6, 0);
  cross.stoppedFor = 2;
  const main = car(0, 70, 6);
  const cars = [cross, main];
  for (let t = 0; t < 1; t += 0.05) {
    stepTraffic(cars, [], 0.05);
    assert.ok(carPose(LANES[2], cross.s).x - cross.length / 2 > STREET.roadHalf, "no entra a la esquina");
  }
});

test("los autos entran y salen lejos, dentro de la bruma (más allá de 60 m)", () => {
  for (const lane of LANES) {
    assert.ok(Math.abs(lane.from) > 60 && Math.abs(lane.to) > 60);
  }
});
