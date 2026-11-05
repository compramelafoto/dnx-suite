import test from "node:test";
import assert from "node:assert/strict";
import { resolveProfileCountryUpdate } from "./profile-country";

test("sin país pedido no cambia nada", () => {
  const r = resolveProfileCountryUpdate({ requestedCode: undefined, currentCode: "AR", albumCount: 5 });
  assert.deepEqual(r, { ok: true, countryCode: "AR", countryName: "Argentina" });
});

test("sin país pedido y sin país actual devuelve nulos", () => {
  const r = resolveProfileCountryUpdate({ requestedCode: undefined, currentCode: null, albumCount: 0 });
  assert.deepEqual(r, { ok: true, countryCode: null, countryName: null });
});

test("AR a AR con álbumes es válido", () => {
  const r = resolveProfileCountryUpdate({ requestedCode: "AR", currentCode: "AR", albumCount: 4 });
  assert.deepEqual(r, { ok: true, countryCode: "AR", countryName: "Argentina" });
});

test("sin país actual (cuenta como AR) a MX con álbumes se rechaza con 409", () => {
  const r = resolveProfileCountryUpdate({ requestedCode: "MX", currentCode: null, albumCount: 2 });
  assert.deepEqual(r, {
    ok: false,
    status: 409,
    error: "Para cambiar el país con álbumes creados, escribinos y lo hacemos nosotros.",
  });
});

test("sin país actual a AR con álbumes es válido", () => {
  const r = resolveProfileCountryUpdate({ requestedCode: "AR", currentCode: null, albumCount: 2 });
  assert.deepEqual(r, { ok: true, countryCode: "AR", countryName: "Argentina" });
});

test("sin país actual a MX sin álbumes es válido", () => {
  const r = resolveProfileCountryUpdate({ requestedCode: "MX", currentCode: null, albumCount: 0 });
  assert.deepEqual(r, { ok: true, countryCode: "MX", countryName: "México" });
});

test("AR a MX con 3 álbumes se rechaza con 409", () => {
  const r = resolveProfileCountryUpdate({ requestedCode: "MX", currentCode: "AR", albumCount: 3 });
  assert.deepEqual(r, {
    ok: false,
    status: 409,
    error: "Para cambiar el país con álbumes creados, escribinos y lo hacemos nosotros.",
  });
});

test("AR a MX sin álbumes es válido", () => {
  const r = resolveProfileCountryUpdate({ requestedCode: "MX", currentCode: "AR", albumCount: 0 });
  assert.deepEqual(r, { ok: true, countryCode: "MX", countryName: "México" });
});

test("código no soportado devuelve 400", () => {
  const r = resolveProfileCountryUpdate({ requestedCode: "XX", currentCode: null, albumCount: 0 });
  assert.deepEqual(r, { ok: false, status: 400, error: "País no válido" });
});
