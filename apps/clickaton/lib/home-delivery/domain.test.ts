import assert from "node:assert/strict";
import test from "node:test";

import {
  homeDeliveryOffer,
  isInExcludedCity,
  parseHomeDeliveryAddress,
  type HomeDeliveryConfig,
} from "./domain";

const config: HomeDeliveryConfig = {
  enabled: true,
  feeAmount: 1_000_000,
  guaranteedUntil: new Date("2026-12-13T02:59:59.999Z"),
  excludedCity: "Rosario",
  excludedProvince: "Santa Fe",
};

const valida = {
  recipientName: "Ana Pérez",
  documentNumber: "30.123.456",
  phone: "+54 351 555-1234",
  street: "Av. Colón",
  streetNumber: "1234",
  floor: "",
  city: "Córdoba",
  province: "Córdoba",
  postalCode: "5000",
  reference: "",
};

test("sin configuración, apagada o sin monto no se ofrece", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  assert.equal(homeDeliveryOffer(null, now), null);
  assert.equal(homeDeliveryOffer({ ...config, enabled: false }, now), null);
  assert.equal(homeDeliveryOffer({ ...config, feeAmount: 0 }, now), null);
});

test("hasta el 12/12 inclusive se garantiza la llegada; después se avisa", () => {
  const antes = homeDeliveryOffer(config, new Date("2026-12-12T23:00:00-03:00"));
  assert.equal(antes?.guaranteedNow, true);
  const despues = homeDeliveryOffer(config, new Date("2026-12-13T00:30:00-03:00"));
  assert.equal(despues?.guaranteedNow, false);
  assert.equal(despues?.feeAmount, 1_000_000);
});

test("las variantes de Rosario quedan afuera; otra ciudad no", () => {
  const variantes: [string, string][] = [
    ["Rosario", "Santa Fe"],
    ["ROSARIO", "Snta Fe"],
    ["Rosario (CP 2000)", "santa fe"],
  ];
  for (const [city, province] of variantes) {
    assert.equal(isInExcludedCity({ city, province }, config), true, city);
  }
  assert.equal(isInExcludedCity({ city: "Funes", province: "Santa Fe" }, config), false);
  assert.equal(isInExcludedCity({ city: "Rosario del Tala", province: "Entre Ríos" }, config), false);
});

test("sin provincia en la edición alcanza con la ciudad", () => {
  const sinProvincia = { excludedCity: "Rosario", excludedProvince: null };
  assert.equal(isInExcludedCity({ city: "rosario", province: "Otra" }, sinProvincia), true);
  assert.equal(isInExcludedCity({ city: "Córdoba", province: "Córdoba" }, { excludedCity: null, excludedProvince: null }), false);
});

test("un domicilio completo pasa y se limpia", () => {
  const r = parseHomeDeliveryAddress(valida);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.address.documentNumber, "30123456");
  assert.equal(r.address.floor, null);
  assert.equal(r.address.reference, null);
});

test("acepta el CPA de 8 caracteres", () => {
  const r = parseHomeDeliveryAddress({ ...valida, postalCode: "x5000abc" });
  assert.equal(r.ok, true);
});

test("marca cada campo que falta", () => {
  const r = parseHomeDeliveryAddress({ ...valida, street: "", postalCode: "12", documentNumber: "abc" });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.errors["delivery.street"]);
  assert.ok(r.errors["delivery.postalCode"]);
  assert.ok(r.errors["delivery.documentNumber"]);
  assert.equal(r.errors["delivery.city"], undefined);
});
