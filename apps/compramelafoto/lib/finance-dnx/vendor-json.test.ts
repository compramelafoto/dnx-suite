import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@prisma/client";

import { toVendorJson } from "./vendor-json";

const proveedorConReparto = {
  id: 1,
  key: "vercel",
  name: "Vercel",
  category: "INFRA",
  billingCurrency: "USD",
  billingCycle: "MENSUAL",
  paymentMethod: null,
  active: true,
  notes: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  allocations: [
    { id: 10, vendorId: 1, platformKey: "clf", sharePercent: new Prisma.Decimal("60.00") },
    { id: 11, vendorId: 1, platformKey: "fotoffice", sharePercent: new Prisma.Decimal("40.00") },
  ],
};

test("convierte sharePercent de Decimal a number, sin perder el valor exacto", () => {
  const resultado = toVendorJson(proveedorConReparto);

  assert.equal(typeof resultado.allocations[0].sharePercent, "number");
  assert.equal(resultado.allocations[0].sharePercent, 60);
  assert.equal(typeof resultado.allocations[1].sharePercent, "number");
  assert.equal(resultado.allocations[1].sharePercent, 40);
});

test("conserva el valor exacto de un reparto con decimales (no lo redondea)", () => {
  const resultado = toVendorJson({
    ...proveedorConReparto,
    allocations: [
      { id: 10, vendorId: 1, platformKey: "clf", sharePercent: new Prisma.Decimal("33.33") },
      { id: 11, vendorId: 1, platformKey: "fotoffice", sharePercent: new Prisma.Decimal("66.67") },
    ],
  });

  assert.equal(resultado.allocations[0].sharePercent, 33.33);
  assert.equal(resultado.allocations[1].sharePercent, 66.67);
});

test("no toca el resto de los campos del proveedor ni del reparto", () => {
  const resultado = toVendorJson(proveedorConReparto);

  assert.equal(resultado.key, "vercel");
  assert.equal(resultado.name, "Vercel");
  assert.equal(resultado.allocations.length, 2);
  assert.equal(resultado.allocations[0].platformKey, "clf");
  assert.equal(resultado.allocations[0].vendorId, 1);
});
