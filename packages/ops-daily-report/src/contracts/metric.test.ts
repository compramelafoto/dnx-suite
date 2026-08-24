import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMetric } from "./metric";

test("calcula la variación contra el día anterior", () => {
  const metric = buildMetric({
    key: "paidOrders",
    label: "Pedidos pagados",
    value: 12,
    format: "count",
    previousValue: 10,
    sevenDayAverage: 8,
  });

  assert.equal(metric.changeRatio, 0.2);
});

test("sin día anterior no hay variación", () => {
  const metric = buildMetric({
    key: "paidOrders",
    label: "Pedidos pagados",
    value: 12,
    format: "count",
    previousValue: null,
    sevenDayAverage: null,
  });

  assert.equal(metric.changeRatio, null);
});

test("si ayer fue cero no se inventa un porcentaje infinito", () => {
  const metric = buildMetric({
    key: "paidOrders",
    label: "Pedidos pagados",
    value: 5,
    format: "count",
    previousValue: 0,
    sevenDayAverage: 1,
  });

  assert.equal(metric.changeRatio, null);
});

test("una caída se expresa como variación negativa", () => {
  const metric = buildMetric({
    key: "revenue",
    label: "Facturación",
    value: 50_000,
    format: "currencyArs",
    previousValue: 100_000,
    sevenDayAverage: 80_000,
  });

  assert.equal(metric.changeRatio, -0.5);
});

test("rechaza valores no finitos en lugar de propagar NaN al correo", () => {
  assert.throws(
    () =>
      buildMetric({
        key: "roto",
        label: "Roto",
        value: Number.NaN,
        format: "count",
        previousValue: null,
        sevenDayAverage: null,
      }),
    /valor no finito/i,
  );
});
