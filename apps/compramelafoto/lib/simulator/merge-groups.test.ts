import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeGroupsByMaterial } from "./merge-groups";

test("grupos: los triángulos de cada material quedan juntos y en orden", () => {
  // Tres triángulos: material 1, material 0, material 1.
  const index = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const groups = [
    { start: 0, count: 3, materialIndex: 1 },
    { start: 3, count: 3, materialIndex: 0 },
    { start: 6, count: 3, materialIndex: 1 },
  ];
  const r = mergeGroupsByMaterial(index, groups)!;
  assert.deepEqual(r.index, [3, 4, 5, 0, 1, 2, 6, 7, 8]);
  assert.deepEqual(r.groups, [
    { start: 0, count: 3, materialIndex: 0 },
    { start: 3, count: 6, materialIndex: 1 },
  ]);
});

test("grupos: si ya hay uno por material no se toca", () => {
  assert.equal(mergeGroupsByMaterial([0, 1, 2], [{ start: 0, count: 3, materialIndex: 0 }]), null);
});
