import assert from "node:assert/strict";
import { test } from "node:test";

import { frontFrame, planBuilding, planCorner } from "./facade-plan";
import {
  BUILDING_LINE,
  STREET,
  buildStreetLayout,
  resolveStreetCollision,
  streetGroundHeight,
} from "./street-layout";
import { pathLength, planStreetPeople, samplePath } from "./street-people";

const layout = buildStreetLayout();

test("la calle es siempre la misma (semilla fija)", () => {
  assert.deepEqual(buildStreetLayout(), layout);
  assert.notDeepEqual(buildStreetLayout(7).buildings.map((b) => b.floors), layout.buildings.map((b) => b.floors));
});

test("los edificios están sobre la línea de edificación, de 6 a 15 m de frente y 2 a 7 pisos", () => {
  assert.ok(layout.buildings.length > 20);
  for (const b of layout.buildings) {
    const onMain = Math.abs(Math.abs(b.start[0]) - BUILDING_LINE) < 1e-9 && Math.abs(Math.abs(b.end[0]) - BUILDING_LINE) < 1e-9;
    const onCross = Math.abs(Math.abs(b.start[1]) - BUILDING_LINE) < 1e-9 && Math.abs(Math.abs(b.end[1]) - BUILDING_LINE) < 1e-9;
    assert.ok(onMain || onCross, b.id);
    assert.ok(b.modules >= 2 && b.modules <= 5, `${b.id}: ${b.modules}`);
    assert.ok(b.floors >= 2 && b.floors <= 7);
    assert.equal(b.ground.length, b.modules);
  }
});

test("los frentes de una cuadra no se pisan ni dejan huecos", () => {
  const fronts = new Map<string, typeof layout.buildings>();
  for (const b of layout.buildings) {
    const key = b.id.replace(/-\d+$/, "");
    fronts.set(key, [...(fronts.get(key) ?? []), b]);
  }
  for (const list of fronts.values()) {
    for (let i = 1; i < list.length; i += 1) {
      assert.deepEqual(list[i].start, list[i - 1].end);
    }
  }
});

test("cada fachada mira a la calle (la cara del kit apunta a la normal)", () => {
  for (const b of layout.buildings) {
    const f = frontFrame(b.start, b.end, b.normal);
    // +Z local tras la rotación: (sin θ, cos θ).
    const face = [Math.sin(f.rotationY), Math.cos(f.rotationY)];
    assert.ok(Math.abs(face[0] - b.normal[0]) < 1e-9 && Math.abs(face[1] - b.normal[1]) < 1e-9, b.id);
    assert.ok(Math.abs(f.length - b.modules * STREET.module) < 1e-9);
  }
});

test("un edificio lleva planta baja, pisos con ventanas, cornisa y remate", () => {
  const b = layout.buildings[0];
  const pieces = planBuilding(b);
  const walls = pieces.filter((p) => p.piece.startsWith("wall_") && !p.piece.includes("pier"));
  assert.equal(walls.length, b.modules * b.floors);
  assert.equal(pieces.filter((p) => p.piece.startsWith("crown_standard")).length, b.modules);
  const top = Math.max(...pieces.map((p) => p.position[1]));
  assert.equal(top, b.floors * STREET.floorHeight);
  assert.ok(pieces.filter((p) => p.tint).every((p) => p.tint === b.tint));
});

test("las ochavas miran a la esquina y tienen la altura de su edificio", () => {
  for (const c of layout.corners) {
    const [piece] = planCorner(c);
    const face = [Math.sin(piece.rotationY) + Math.cos(piece.rotationY), Math.cos(piece.rotationY) - Math.sin(piece.rotationY)];
    // La cara diagonal del kit (+1,+1) tiene que apuntar hacia el centro del cruce.
    assert.ok(face[0] * c.normal[0] + face[1] * c.normal[1] > 1.3, c.id);
  }
});

test("no se puede entrar a las manzanas y la vereda está 15 cm más alta", () => {
  const [x, z] = resolveStreetCollision(BUILDING_LINE + 2, 25, layout.colliders);
  assert.ok(x <= BUILDING_LINE - 0.3, `x=${x}`);
  assert.equal(z, 25);
  const free = resolveStreetCollision(0, 25, layout.colliders);
  assert.deepEqual(free, [0, 25]);
  assert.equal(streetGroundHeight(0, 25), 0);
  assert.equal(streetGroundHeight(5.5, 25), STREET.curbHeight);
});

test("los peatones van y vuelven por su recorrido sin saltos", () => {
  const { walkers, standers } = planStreetPeople(layout);
  assert.ok(walkers.length >= 10);
  assert.ok(standers.length >= 3);
  const path = walkers[0].path;
  const total = pathLength(path);
  const end = samplePath(path, total - 0.01);
  const back = samplePath(path, total + 1);
  assert.ok(Math.hypot(end.x - back.x, end.z - back.z) < 1.1);
  assert.ok(Math.abs(Math.abs(end.heading - back.heading) - Math.PI) < 1e-6, "da media vuelta");
  let prev = samplePath(path, 0);
  for (let d = 0.5; d < total * 3; d += 0.5) {
    const at = samplePath(path, d);
    assert.ok(Math.hypot(at.x - prev.x, at.z - prev.z) <= 0.5 + 1e-9);
    prev = at;
  }
});
