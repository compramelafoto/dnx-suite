import assert from "node:assert/strict";
import { test } from "node:test";

import { BUILDING_LINE, CITY, STREET } from "./street-layout";
import { LANES, carPose, createTraffic, stepTraffic, type TrafficCar } from "./street-traffic";

function run(cars: TrafficCar[], seconds: number, walkers: [number, number][] = [], onStep?: () => void) {
  for (let t = 0; t < seconds; t += 0.05) {
    stepTraffic(cars, walkers, 0.05);
    onStep?.();
  }
}

function car(lane: number, s: number, v: number, v0 = Math.max(v, 8)): TrafficCar {
  return { id: `t${lane}`, lane, s, v, v0, length: 4.4, stoppedFor: 0, clearedAt: null, parked: false, model: 0 };
}

/** Distancia sobre el carril hasta una coordenada del eje. */
const sAt = (lane: number, coord: number) => (coord - LANES[lane].from) * LANES[lane].dir;
const zLane = LANES.findIndex((l) => l.axis === "z" && l.street === 0);
const xLane = LANES.findIndex((l) => l.axis === "x" && l.street === 0);

test("hay carriles en todas las calles, de mano única y alternadas", () => {
  for (const at of CITY.lines) {
    assert.ok(LANES.some((l) => l.axis === "z" && l.street === at));
    assert.ok(LANES.some((l) => l.axis === "x" && l.street === at));
  }
  const dirs = CITY.lines.map((at) => LANES.find((l) => l.axis === "z" && l.street === at)!.dir);
  for (let i = 1; i < dirs.length; i += 1) assert.notEqual(dirs[i], dirs[i - 1]);
});

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
  const lane = LANES[zLane];
  // Senda del lado por el que llega el auto a la esquina z = 101.
  const crosswalk = 101 - lane.dir * (STREET.roadHalf + STREET.sidewalk / 2);
  const c = car(zLane, sAt(zLane, crosswalk) - 40, 10);
  run([c], 15, [[lane.offset, crosswalk]]);
  const front = carPose(lane, c.s).z * lane.dir + c.length / 2;
  assert.ok(c.v < 0.2, `velocidad ${c.v}`);
  assert.ok(front < crosswalk * lane.dir - 0.5, `frente en ${front}`);
  run([c], 5, []);
  assert.ok(c.v > 3, "arranca cuando el peatón pasó");
});

test("en las calles en X se detiene en el PARE y después cruza", () => {
  const lane = LANES[xLane];
  const corner = 101;
  const c = car(xLane, sAt(xLane, corner) - 30, 8);
  let atStop: number | null = null;
  let crossed = false;
  for (let t = 0; t < 30; t += 0.05) {
    stepTraffic([c], [], 0.05);
    const x = carPose(lane, c.s).x;
    if (atStop === null && c.v < 0.3) atStop = x;
    if ((x - corner) * lane.dir > 10) crossed = true;
  }
  assert.ok(crossed, "cruzó la esquina");
  assert.ok(atStop !== null, "se detuvo");
  // El frente quedó antes de la senda.
  assert.ok((corner - atStop) * lane.dir - c.length / 2 > BUILDING_LINE - 0.1, `frenó en x=${atStop}`);
});

test("la transversal espera si viene un auto por la calle con prioridad", () => {
  const corner = 0;
  const xl = LANES[xLane];
  const zl = LANES[zLane];
  // Parado en el PARE de la esquina (0, 0); por la calle en Z viene otro a 10 m.
  const cross = car(xLane, sAt(xLane, corner) - (BUILDING_LINE + 0.5) - 2.2 - 2.2, 0);
  cross.stoppedFor = 2;
  const main = car(zLane, sAt(zLane, corner) - 10, 6);
  for (let t = 0; t < 1; t += 0.05) {
    stepTraffic([cross, main], [], 0.05);
    const x = carPose(xl, cross.s).x;
    assert.ok((corner - x) * xl.dir - cross.length / 2 > STREET.roadHalf, "no entra a la esquina");
  }
  void zl;
});

test("los autos entran y salen lejos, dentro de la bruma (fuera del barrio)", () => {
  for (const lane of LANES) {
    for (const end of [lane.from, lane.to]) assert.ok(end < CITY.reach[0] || end > CITY.reach[1]);
  }
});
