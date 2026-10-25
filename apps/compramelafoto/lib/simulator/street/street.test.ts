import assert from "node:assert/strict";
import { test } from "node:test";

import { frontFrame, planBuilding, planCorner } from "./facade-plan";
import {
  BUILDING_LINE,
  CITY,
  STREET,
  buildStreetLayout,
  onLawn,
  resolveStreetCollision,
  streetGroundHeight,
} from "./street-layout";
import { closestDistanceOnPath, figureForDevice, isRunning, isWoman, pathLength, planStreetPeople, samplePath } from "./street-people";

const layout = buildStreetLayout();

test("la ciudad es siempre la misma (semilla fija)", () => {
  assert.deepEqual(buildStreetLayout(), layout);
  assert.notDeepEqual(buildStreetLayout(7).buildings.map((b) => b.floors), layout.buildings.map((b) => b.floors));
});

test("son 3 × 3 manzanas visitables con plaza, casas, centro y pasajes, y un anillo alrededor", () => {
  const inner = layout.blocks.filter((b) => !b.ring);
  assert.equal(inner.length, 9);
  assert.equal(inner.filter((b) => b.kind === "plaza").length, 1);
  assert.ok(inner.filter((b) => b.kind === "casas").length >= 2);
  assert.ok(inner.filter((b) => b.kind === "centro").length >= 2);
  assert.equal(inner.filter((b) => b.alley).length, 2);
  assert.equal(layout.blocks.filter((b) => b.ring).length, 16);
  // Unas 10 veces más grande que la esquina original (120 × 72 m).
  const side = CITY.reach[1] - CITY.reach[0];
  assert.ok((side * side) / (120 * 72) > 9);
});

test("los edificios están sobre la línea de edificación de su manzana y miran a la calle", () => {
  const byId = new Map(layout.blocks.map((b) => [b.id, b]));
  for (const b of layout.buildings) {
    const block = byId.get(b.chunk)!;
    const onX = [block.x0, block.x1].some((x) => Math.abs(b.start[0] - x) < 1e-9 && Math.abs(b.end[0] - x) < 1e-9);
    const onZ = [block.z0, block.z1].some((z) => Math.abs(b.start[1] - z) < 1e-9 && Math.abs(b.end[1] - z) < 1e-9);
    assert.ok(onX || onZ, b.id);
    assert.ok(b.modules >= 1 && b.modules <= 5, `${b.id}: ${b.modules}`);
    assert.ok(b.floors >= 1 && b.floors <= 8);
    assert.equal(b.ground.length, b.modules);
    const f = frontFrame(b.start, b.end, b.normal);
    const face = [Math.sin(f.rotationY), Math.cos(f.rotationY)];
    assert.ok(Math.abs(face[0] - b.normal[0]) < 1e-9 && Math.abs(face[1] - b.normal[1]) < 1e-9, b.id);
    // La normal apunta hacia afuera de la manzana.
    const mid = [(b.start[0] + b.end[0]) / 2 + b.normal[0], (b.start[1] + b.end[1]) / 2 + b.normal[1]];
    const inside = mid[0] > block.x0 && mid[0] < block.x1 && mid[1] > block.z0 && mid[1] < block.z1;
    assert.ok(!inside, `${b.id} mira hacia adentro`);
  }
});

test("las casas son bajas y el centro tiene edificios altos", () => {
  const byId = new Map(layout.blocks.map((b) => [b.id, b]));
  const floors = (kind: string) => layout.buildings.filter((b) => byId.get(b.chunk)!.kind === kind).map((b) => b.floors);
  assert.ok(Math.max(...floors("casas")) <= 2);
  assert.ok(Math.max(...floors("centro")) >= 6);
});

test("cada frente llena su lado entre ochavas, salvo la boca del pasaje", () => {
  const sides = new Map<string, typeof layout.buildings>();
  for (const b of layout.buildings) {
    const key = b.id.replace(/-\d+$/, "");
    sides.set(key, [...(sides.get(key) ?? []), b]);
  }
  const full = 27;
  for (const [key, list] of sides) {
    const block = layout.blocks.find((b) => key.startsWith(`${b.id}-`))!;
    const total = list.reduce((acc, b) => acc + b.modules, 0);
    const holes = list.slice(1).filter((b, i) => b.start[0] !== list[i].end[0] || b.start[1] !== list[i].end[1]).length;
    if (block.alley && total !== full) {
      assert.equal(total, full - 2, key);
      assert.equal(holes, 1, key);
    } else {
      assert.equal(total, full, key);
      assert.equal(holes, 0, key);
    }
  }
});

test("un edificio lleva planta baja, pisos con ventanas, cornisa y remate", () => {
  const b = layout.buildings.find((x) => x.floors >= 3)!;
  const pieces = planBuilding(b);
  const walls = pieces.filter((p) => p.piece.startsWith("wall_") && !p.piece.includes("pier"));
  assert.equal(walls.length, b.modules * b.floors);
  assert.equal(pieces.filter((p) => p.piece.startsWith("crown_standard")).length, b.modules);
  assert.equal(Math.max(...pieces.map((p) => p.position[1])), b.floors * STREET.floorHeight);
  assert.ok(pieces.every((p) => p.chunk === b.chunk));
});

test("las ochavas miran al cruce", () => {
  for (const c of layout.corners) {
    const [piece] = planCorner(c);
    const face = [Math.sin(piece.rotationY) + Math.cos(piece.rotationY), Math.cos(piece.rotationY) - Math.sin(piece.rotationY)];
    assert.ok(face[0] * c.normal[0] + face[1] * c.normal[1] > 1.3, c.id);
  }
});

test("no se puede entrar a las manzanas, sí al pasaje; la vereda está 15 cm más alta", () => {
  // Manzana del centro, al este de la calle x = 0.
  const [x, z] = resolveStreetCollision(BUILDING_LINE + 2, -40, layout.colliders);
  assert.ok(x <= BUILDING_LINE - 0.3, `x=${x}`);
  assert.equal(z, -40);
  assert.deepEqual(resolveStreetCollision(0, -40, layout.colliders), [0, -40]);
  const alley = layout.blocks.find((b) => b.alley)!.alley!;
  const mid = (alley.from + alley.to) / 2;
  const inAlley: [number, number] = alley.axis === "x" ? [mid, alley.at] : [alley.at, mid];
  assert.deepEqual(resolveStreetCollision(...inAlley, layout.colliders), inAlley);
  assert.equal(streetGroundHeight(0, -40), 0);
  assert.equal(streetGroundHeight(5.5, -40), STREET.curbHeight);
  assert.equal(streetGroundHeight(...layout.plaza.center), STREET.curbHeight);
  // Más allá del alcance de las calles no se sigue.
  const [ex] = resolveStreetCollision(CITY.reach[1] + 5, 0, layout.colliders);
  assert.ok(ex <= CITY.reach[1]);
});

test("la plaza tiene césped, senderos y árboles sólo en el césped", () => {
  const p = layout.plaza;
  assert.ok(p.paths.length >= 8);
  assert.ok(!onLawn(p, ...p.center));
  const trees = layout.props.filter((x) => x.kind === "tree" && x.position[0] > p.block.x0 && x.position[0] < p.block.x1 && x.position[2] > p.block.z0 && x.position[2] < p.block.z1);
  assert.ok(trees.length > 20);
  for (const t of trees) assert.ok(onLawn(p, t.position[0], t.position[2]));
  assert.equal(layout.props.filter((x) => x.kind === "statue").length, 1);
});

test("hay detalles en el piso y en las paredes", () => {
  const kinds = new Set(layout.groundDecals.map((d) => d.kind));
  for (const k of ["puddle", "leaves", "petals", "patch", "chalk", "drain", "arrow"]) assert.ok(kinds.has(k as never), k);
  assert.ok(layout.wallDecals.some((d) => d.kind === "graffiti"));
  assert.ok(layout.walls.length > 4);
});

test("los peatones caminan en circuitos cerrados: sin saltos, cortes ni medias vueltas", () => {
  const { walkers, standers } = planStreetPeople(layout);
  // Caminantes y unos pocos corredores (ropa deportiva) en las vueltas largas.
  assert.ok(walkers.length >= 20 && walkers.length <= 70, `${walkers.length}`);
  assert.ok(walkers.filter((w) => isRunning(w.gait)).length >= 4, "faltan corredores");
  assert.ok(standers.length >= 5);
  for (const w of walkers) {
    const total = pathLength(w.path);
    let prev = samplePath(w.path, 0);
    for (let d = 0.25; d <= total * 2; d += 0.25) {
      const at = samplePath(w.path, d);
      assert.ok(Math.hypot(at.x - prev.x, at.z - prev.z) <= 0.25 + 1e-9, `${w.id} en ${d}`);
      const turn = Math.abs(Math.atan2(Math.sin(at.heading - prev.heading), Math.cos(at.heading - prev.heading)));
      assert.ok(turn <= Math.PI / 2 + 1e-6, `${w.id} gira ${turn}`);
      prev = at;
    }
  }
});

test("los peatones cruzan la calle por la senda, nunca por el medio de la esquina", () => {
  for (const path of layout.walkPaths) {
    for (let i = 0; i < path.points.length; i += 1) {
      const a = path.points[i];
      const b = path.points[(i + 1) % path.points.length];
      for (let t = 0; t <= 1; t += 0.01) {
        const x = a[0] + (b[0] - a[0]) * t;
        const z = a[1] + (b[1] - a[1]) * t;
        for (const line of CITY.lines) {
          const onX = Math.abs(x - line) < STREET.roadHalf;
          const onZ = Math.abs(z - line) < STREET.roadHalf;
          // Nunca en la caja donde se cruzan las dos calzadas.
          if (onX) assert.ok(!CITY.lines.some((l) => Math.abs(z - l) < STREET.roadHalf), `${path.id} en (${x}, ${z})`);
          if (onZ) assert.ok(!CITY.lines.some((l) => Math.abs(x - l) < STREET.roadHalf), `${path.id} en (${x}, ${z})`);
        }
      }
    }
  }
});

test("después de posar, la persona retoma el circuito desde el punto más cercano", () => {
  const path = layout.walkPaths[0].points;
  const at = samplePath(path, 37);
  // Se corrió 40 cm hacia un costado del camino.
  const back = closestDistanceOnPath(path, at.x + Math.cos(at.heading) * 0.4, at.z - Math.sin(at.heading) * 0.4);
  assert.ok(Math.abs(back - 37) < 0.01, `${back}`);
});

test("calle en el celular: cuatro personas distintas, del mismo género y menos gente caminando", () => {
  const layout = buildStreetLayout();
  const { walkers, standers } = planStreetPeople(layout, true);
  const all = [...walkers, ...standers];
  assert.ok(new Set(all.map((p) => p.figure)).size <= 4);
  const desktop = planStreetPeople(layout);
  const byId = new Map([...desktop.walkers, ...desktop.standers].map((p) => [p.id, p.figure]));
  for (const p of all) assert.equal(isWoman(p.figure), isWoman(byId.get(p.id)!));
  // Menos gente que en la computadora, pero todos los corredores.
  assert.ok(walkers.length < desktop.walkers.length);
  assert.equal(walkers.filter((w) => w.id.startsWith("run")).length, desktop.walkers.filter((w) => w.id.startsWith("run")).length);
  assert.equal(figureForDevice("valentina", false), "valentina");
});
