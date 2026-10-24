import assert from "node:assert/strict";
import test from "node:test";

import { PublicRegistrationValidationError } from "../domain/errors";
import { newIdempotencyKey } from "../infrastructure/in-memory-public-registration-repository";
import { crearEscenario, type Escenario } from "./location-consent-funnel.fixture";

const domicilio = {
  recipientName: "Ana Pérez",
  documentNumber: "30123456",
  phone: "3515551234",
  street: "Av. Colón",
  streetNumber: "1234",
  city: "Córdoba",
  province: "Córdoba",
  postalCode: "5000",
};

function conEnvio(esc: Escenario, overrides?: { guaranteedUntil?: Date | null }) {
  esc.store.homeDeliveryConfigs.set("ed_consent", {
    enabled: true,
    feeAmount: 1_000_000,
    guaranteedUntil:
      overrides?.guaranteedUntil === undefined
        ? new Date("2026-12-13T02:59:59.999Z")
        : overrides.guaranteedUntil,
    excludedCity: "Rosario",
    excludedProvince: "Santa Fe",
  });
}

function inscribir(esc: Escenario, homeDelivery?: Record<string, unknown> | null) {
  return esc.service.createRegistration({
    editionSlug: esc.editionSlug,
    venueId: null,
    ticketTypeId: esc.ticketTypeId,
    variantChoices: [],
    participant: {
      firstName: "Ana",
      lastName: "Pérez",
      email: `ana+${newIdempotencyKey()}@example.com`,
      country: "AR",
      birthDate: "1990-04-12",
    },
    acceptTerms: true,
    acceptPrivacy: true,
    acceptImage: true,
    instagramHandle: "anaperez",
    profilePhotoAssetId: "asset-test",
    idempotencyKey: newIdempotencyKey(),
    homeDelivery,
  });
}

test("el contexto ofrece el envío sólo si la edición lo tiene encendido", async () => {
  const esc = crearEscenario();
  assert.equal((await esc.service.getContext(esc.editionSlug)).homeDelivery, null);
  conEnvio(esc);
  const ctx = await esc.service.getContext(esc.editionSlug);
  assert.equal(ctx.homeDelivery?.feeAmount, 1_000_000);
  assert.equal(ctx.homeDelivery?.guaranteedNow, true);
});

test("sin envío, el precio queda como siempre", async () => {
  const esc = crearEscenario();
  conEnvio(esc);
  const s = await inscribir(esc);
  assert.equal(s.totalAmount, 1_500_000);
  assert.equal(s.homeDelivery, null);
});

test("con envío se suman $10.000 al total y se guarda el domicilio", async () => {
  const esc = crearEscenario();
  conEnvio(esc);
  const s = await inscribir(esc, domicilio);
  assert.equal(s.totalAmount, 2_500_000);
  assert.equal(s.subtotalAmount, 2_500_000);
  assert.deepEqual(s.homeDelivery, {
    feeAmount: 1_000_000,
    guaranteed: true,
    city: "Córdoba",
    province: "Córdoba",
  });
  const guardado = esc.store.shippings.get(s.registrationId);
  assert.equal(guardado?.postalCode, "5000");
  const reg = esc.store.domain.registrations.get(s.registrationId);
  assert.equal(reg?.money.totalAmount, 2_500_000);
});

test("después de la fecha garantizada se vende igual, sin garantía", async () => {
  const esc = crearEscenario();
  conEnvio(esc, { guaranteedUntil: new Date("2026-09-15T00:00:00Z") });
  const s = await inscribir(esc, domicilio);
  assert.equal(s.totalAmount, 2_500_000);
  assert.equal(s.homeDelivery?.guaranteed, false);
});

test("un domicilio en Rosario se rechaza", async () => {
  const esc = crearEscenario();
  conEnvio(esc);
  await assert.rejects(
    inscribir(esc, { ...domicilio, city: "ROSARIO", province: "Santa Fe", postalCode: "2000" }),
    (e: unknown) =>
      e instanceof PublicRegistrationValidationError &&
      Boolean(e.fieldErrors["delivery.city"]),
  );
});

test("si la edición no ofrece envío, pedirlo se rechaza", async () => {
  const esc = crearEscenario();
  await assert.rejects(inscribir(esc, domicilio), /no ofrece envío/);
});

test("un domicilio incompleto se rechaza campo por campo", async () => {
  const esc = crearEscenario();
  conEnvio(esc);
  await assert.rejects(
    inscribir(esc, { ...domicilio, postalCode: "" }),
    (e: unknown) =>
      e instanceof PublicRegistrationValidationError &&
      Boolean(e.fieldErrors["delivery.postalCode"]),
  );
});
