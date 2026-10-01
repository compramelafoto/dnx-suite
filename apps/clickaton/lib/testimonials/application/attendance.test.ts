import assert from "node:assert/strict";
import { test } from "node:test";
import { keepWhoAttended } from "./attendance";

const ana = { email: "ana@example.test", attended: true };
const beto = { email: "beto@example.test", attended: true };
const cata = { email: "cata@example.test", attended: false };

test("con acreditación en la edición, sólo entran los que fueron", () => {
  const r = keepWhoAttended([ana, beto, cata]);
  assert.deepEqual(
    r.map((x) => x.email),
    ["ana@example.test", "beto@example.test"],
  );
});

test("si nadie se acreditó, la edición no usó acreditación y entran todos", () => {
  // Sin este respaldo, una edición que no usa el módulo no invitaría a nadie
  // y el silencio parecería que anda bien.
  const sinAcreditacion = [
    { email: "ana@example.test", attended: false },
    { email: "beto@example.test", attended: false },
  ];
  const r = keepWhoAttended(sinAcreditacion);
  assert.equal(r.length, 2);
});

test("una lista vacía sigue vacía", () => {
  assert.deepEqual(keepWhoAttended([]), []);
});

test("si se acreditó uno solo, los demás quedan afuera", () => {
  const r = keepWhoAttended([ana, cata]);
  assert.deepEqual(
    r.map((x) => x.email),
    ["ana@example.test"],
  );
});
