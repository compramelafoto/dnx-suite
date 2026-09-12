import assert from "node:assert/strict";
import test from "node:test";

import { parseVendorForm } from "./vendor-form";

const valido = {
  key: "vercel",
  name: "Vercel",
  category: "INFRA",
  billingCurrency: "USD",
  billingCycle: "MENSUAL",
  allocations: [
    { platformKey: "clf", sharePercent: 60 },
    { platformKey: "fotoffice", sharePercent: 40 },
  ],
};

test("acepta un proveedor bien cargado", () => {
  const resultado = parseVendorForm(valido);

  assert.equal(resultado.ok, true);
});

test("rechaza un reparto que no suma 100", () => {
  const resultado = parseVendorForm({
    ...valido,
    allocations: [{ platformKey: "clf", sharePercent: 60 }],
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /100/);
});

test("rechaza una plataforma que no existe", () => {
  const resultado = parseVendorForm({
    ...valido,
    allocations: [{ platformKey: "inventada", sharePercent: 100 }],
  });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /plataforma/i);
});

test("rechaza una moneda que no es USD ni ARS", () => {
  const resultado = parseVendorForm({ ...valido, billingCurrency: "EUR" });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /moneda/i);
});

test("rechaza un proveedor sin nombre", () => {
  const resultado = parseVendorForm({ ...valido, name: "  " });

  assert.equal(resultado.ok, false);
  assert.match(resultado.ok === false ? resultado.error : "", /nombre/i);
});
