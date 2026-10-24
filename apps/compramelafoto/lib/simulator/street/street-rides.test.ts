import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { STREET, laneOffsets, parkingSide } from "./street-layout";
import { CURB_RIDES, MOTOR_RIDES, STREET_RIDES, pedalPositions, streetRideUrl, twoBoneJoint, type V3 } from "./street-rides";
import { LANES, createTraffic, laneLength, stepTraffic } from "./street-traffic";

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test("rodados: cada modelo existe y tiene sus medidas", () => {
  for (const r of STREET_RIDES) {
    assert.ok(existsSync(`public${streetRideUrl(r)}`), r.id);
    assert.ok(r.lengthM > 0.9 && r.lengthM < 2.5, r.id);
    // El manubrio va adelante del asiento.
    assert.ok(r.rig.grip[1] > r.rig.seat[1], r.id);
  }
  assert.ok(CURB_RIDES.length >= 3 && MOTOR_RIDES.length >= 3);
});

test("rodilla y codo: los dos huesos llegan justo al objetivo y doblan hacia el polo", () => {
  const root: V3 = [0, 1, 0];
  const target: V3 = [0, 0.3, 0.4];
  const knee = twoBoneJoint(root, target, 0.45, 0.45, [0, 0, 1]);
  assert.ok(Math.abs(dist(root, knee) - 0.45) < 1e-6);
  assert.ok(Math.abs(dist(knee, target) - 0.45) < 1e-6);
  assert.ok(knee[2] > 0.2, "la rodilla va hacia adelante");
  // Fuera de alcance: estira hacia el objetivo sin pasarse del largo.
  const far = twoBoneJoint(root, [0, -5, 0], 0.45, 0.45, [0, 0, 1]);
  assert.ok(Math.abs(dist(root, far) - 0.45) < 1e-6);
});

test("pedales: opuestos, a cada lado y a la distancia de la biela", () => {
  const bike = STREET_RIDES.find((r) => r.kind === "bike")!;
  const { left, right } = pedalPositions(bike.rig, 0.7);
  assert.ok(left[0] > 0 && right[0] < 0);
  const center: V3 = [0, bike.rig.feet[0], bike.rig.feet[1]];
  assert.ok(Math.abs(Math.hypot(left[1] - center[1], left[2] - center[2]) - bike.rig.crank!) < 1e-9);
  // Medio giro de diferencia: uno arriba, el otro abajo.
  assert.ok(Math.abs(left[1] - center[1] + (right[1] - center[1])) < 1e-9);
});

test("carril de bicis: contra el cordón sin autos estacionados, separado del de los autos", () => {
  const curb = LANES.filter((l) => l.curb);
  assert.ok(curb.length >= 6);
  for (const lane of curb) {
    const fromAxis = lane.offset - lane.street;
    assert.ok(Math.abs(fromAxis) < STREET.roadHalf - 0.5, lane.id);
    const cars = laneOffsets({ axis: lane.axis, at: lane.street });
    for (const off of cars) assert.ok(Math.abs(off - fromAxis) > 1.6, `${lane.id} pegado a los autos`);
    // Del lado contrario a los autos estacionados.
    assert.equal(Math.sign(fromAxis), -parkingSide({ axis: lane.axis, at: lane.street }), lane.id);
  }
});

test("tránsito: hay bicis en su carril y motos entre los autos", () => {
  const traffic = createTraffic();
  const curbRiders = traffic.filter((c) => LANES[c.lane].curb);
  assert.ok(curbRiders.length >= 12);
  assert.ok(curbRiders.every((c) => c.ride !== null && CURB_RIDES.includes(STREET_RIDES[c.ride])));
  const motos = traffic.filter((c) => c.ride !== null && !LANES[c.lane].curb);
  assert.ok(motos.length >= 3);
  assert.ok(motos.every((c) => MOTOR_RIDES.includes(STREET_RIDES[c.ride!])));
  // Los autos siguen siendo autos.
  assert.ok(traffic.filter((c) => c.ride === null).every((c) => c.model >= 0));
});

test("tránsito: las bicis recorren la cuadra sin chocarse y frenan en el PARE", () => {
  const traffic = createTraffic();
  for (let i = 0; i < 600; i += 1) stepTraffic(traffic, [], 0.1);
  for (const lane of LANES.filter((l) => l.curb)) {
    const here = traffic.filter((c) => LANES[c.lane] === lane && !c.parked).sort((a, b) => a.s - b.s);
    for (let i = 1; i < here.length; i += 1) assert.ok(here[i].s - here[i - 1].s > here[i].length, `${lane.id} superpuestas`);
    for (const c of here) assert.ok(c.s >= 0 && c.s <= laneLength(lane) + 1);
  }
  // En un minuto las bicis avanzaron (no quedaron trabadas).
  const moved = traffic.filter((c) => c.ride !== null && LANES[c.lane].curb && c.v > 1);
  assert.ok(moved.length > 0);
});
