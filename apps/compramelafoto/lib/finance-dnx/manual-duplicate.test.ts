import assert from "node:assert/strict";
import test from "node:test";

import { manualDuplicateOf } from "./manual-duplicate";

test("un gasto sin número de factura del mismo proveedor y mes bloquea otro manual", () => {
  assert.equal(manualDuplicateOf([{ id: 7, invoiceNumber: null }]), 7);
});

test("las facturas con número (leídas del mail) no bloquean la carga manual", () => {
  assert.equal(manualDuplicateOf([{ id: 7, invoiceNumber: "SWURZY-00008" }]), null);
});

test("sin gastos en ese mes no hay duplicado", () => {
  assert.equal(manualDuplicateOf([]), null);
});

test("al editar, el propio gasto no cuenta como duplicado", () => {
  assert.equal(manualDuplicateOf([{ id: 7, invoiceNumber: null }], 7), null);
  assert.equal(manualDuplicateOf([{ id: 7, invoiceNumber: null }, { id: 9, invoiceNumber: null }], 7), 9);
});
