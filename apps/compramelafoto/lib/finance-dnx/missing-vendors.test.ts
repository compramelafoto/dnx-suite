import assert from "node:assert/strict";
import test from "node:test";

import { vendorsAbsentThisMonth } from "./missing-vendors";

const PROVEEDOR_A = { id: 1, key: "google-ads", name: "Google Ads" };
const PROVEEDOR_B = { id: 2, key: "meta-ads", name: "Meta Ads" };

test("un proveedor que no cargó nada este mes aparece como faltante", () => {
  const faltantes = vendorsAbsentThisMonth(
    [{ vendorId: PROVEEDOR_A.id, vendor: PROVEEDOR_A }],
    [],
  );
  assert.deepEqual(faltantes, [PROVEEDOR_A]);
});

test("un proveedor que ya cargó algo este mes no aparece", () => {
  const faltantes = vendorsAbsentThisMonth(
    [{ vendorId: PROVEEDOR_A.id, vendor: PROVEEDOR_A }],
    [PROVEEDOR_A.id],
  );
  assert.deepEqual(faltantes, []);
});

test("sin gasto el mes anterior, no hay nada que reclamar", () => {
  const faltantes = vendorsAbsentThisMonth([], []);
  assert.deepEqual(faltantes, []);
});

test("mezcla: sólo el proveedor que no cargó nada queda en la lista", () => {
  const faltantes = vendorsAbsentThisMonth(
    [
      { vendorId: PROVEEDOR_A.id, vendor: PROVEEDOR_A },
      { vendorId: PROVEEDOR_B.id, vendor: PROVEEDOR_B },
    ],
    [PROVEEDOR_B.id],
  );
  assert.deepEqual(faltantes, [PROVEEDOR_A]);
});

test("un proveedor con dos gastos el mes anterior no se repite en el resultado", () => {
  // Puede pasar (por ejemplo un ajuste manual): la lista de faltantes no
  // debe mostrar dos veces el mismo proveedor.
  const faltantes = vendorsAbsentThisMonth(
    [
      { vendorId: PROVEEDOR_A.id, vendor: PROVEEDOR_A },
      { vendorId: PROVEEDOR_A.id, vendor: PROVEEDOR_A },
    ],
    [],
  );
  assert.deepEqual(faltantes, [PROVEEDOR_A]);
});
