import assert from "node:assert/strict";
import test from "node:test";

import { isAllocationComplete, sumSharePercent } from "./allocation-total";

test("suma un reparto simple", () => {
  const total = sumSharePercent([
    { sharePercent: 60 },
    { sharePercent: 40 },
  ]);

  assert.equal(total, 100);
});

test("no arrastra ruido de punto flotante", () => {
  const total = sumSharePercent([
    { sharePercent: 33.33 },
    { sharePercent: 33.33 },
    { sharePercent: 33.34 },
  ]);

  assert.equal(total, 100);
  assert.equal(isAllocationComplete(total), true);
});

test("detecta un reparto incompleto", () => {
  const total = sumSharePercent([{ sharePercent: 60 }]);

  assert.equal(total, 60);
  assert.equal(isAllocationComplete(total), false);
});

test("detecta un reparto que se pasa de 100", () => {
  const total = sumSharePercent([{ sharePercent: 60 }, { sharePercent: 60 }]);

  assert.equal(total, 120);
  assert.equal(isAllocationComplete(total), false);
});

test("una lista vacía suma 0", () => {
  assert.equal(sumSharePercent([]), 0);
});
