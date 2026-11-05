import test from "node:test";
import assert from "node:assert/strict";
import { resolveCollectionAccess, toCollectionAccountView, type CollectionAccess } from "./collection-access";
import { countryMismatchMessage } from "./collection-check";

type Available = Extract<CollectionAccess, { available: true }>;

function available(countryCode: string): Available {
  const access = resolveCollectionAccess({ enabled: true, countryCode });
  assert.equal(access.available, true);
  return access as Available;
}

const mpRow = {
  provider: "MERCADOPAGO_OWN",
  secretLast4: "1234",
  accountLabel: "FOTOGRAFO_MX",
  accountCountryCode: "MX" as string | null,
  connectedAt: new Date("2026-11-05T12:00:00.000Z"),
  lastCheckedAt: new Date("2026-11-05T12:30:00.000Z") as Date | null,
};

test("con el interruptor apagado no está disponible", () => {
  assert.deepEqual(resolveCollectionAccess({ enabled: false, countryCode: "MX" }), { available: false });
});

test("Argentina y sin país no están disponibles", () => {
  assert.deepEqual(resolveCollectionAccess({ enabled: true, countryCode: "AR" }), { available: false });
  assert.deepEqual(resolveCollectionAccess({ enabled: true, countryCode: null }), { available: false });
});

test("México usa Mercado Pago propio", () => {
  assert.deepEqual(resolveCollectionAccess({ enabled: true, countryCode: "MX" }), {
    available: true,
    provider: "MERCADOPAGO_OWN",
    countryCode: "MX",
    countryName: "México",
  });
});

test("Estados Unidos usa PayPal", () => {
  const access = available("US");
  assert.equal(access.provider, "PAYPAL_OWN");
  assert.equal(access.countryName, "Estados Unidos");
});

test("avisa si la cuenta es de un medio que no corresponde al país", () => {
  const view = toCollectionAccountView(mpRow, available("US"));
  assert.equal(
    view.warning,
    "La cuenta conectada es de Mercado Pago y no corresponde a Estados Unidos. Conectá la cuenta correcta.",
  );
});

test("avisa si la cuenta de Mercado Pago es de otro país", () => {
  const view = toCollectionAccountView({ ...mpRow, accountCountryCode: "BR" }, available("MX"));
  assert.equal(view.warning, countryMismatchMessage("MX", "BR"));
  assert.notEqual(view.warning, null);
});

test("sin diferencias no hay aviso y las fechas salen como texto", () => {
  const view = toCollectionAccountView(mpRow, available("MX"));
  assert.equal(view.warning, null);
  assert.equal(view.connectedAt, "2026-11-05T12:00:00.000Z");
  assert.equal(view.lastCheckedAt, "2026-11-05T12:30:00.000Z");
  assert.equal(view.secretLast4, "1234");
});

test("la vista no expone secretos ni el id de credencial", () => {
  const row = { ...mpRow, credentialId: "dnxcred_x", accessToken: "APP_USR-x", clientSecret: "s" };
  const keys = Object.keys(toCollectionAccountView(row, available("MX")));
  for (const forbidden of ["credentialId", "accessToken", "clientSecret"]) {
    assert.equal(keys.includes(forbidden), false, forbidden);
  }
});
