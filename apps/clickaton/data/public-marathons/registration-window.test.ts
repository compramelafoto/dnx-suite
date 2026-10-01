/**
 * La ficha pública debe distinguir "todavía no abrió" de "ya cerró".
 * Antes ambas caían en not_open y el sitio decía "Inscripciones próximamente"
 * con la ventana vencida.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { presentRegistrationCta } from "@/lib/registration-cta";
import { resolveRegistrationWindow } from "./registration-window";

const now = new Date("2026-09-18T23:00:00.000Z");

test("ventana vigente: abierta", () => {
  assert.equal(
    resolveRegistrationWindow({
      registrationEnabled: true,
      registrationOpenAt: new Date("2026-08-01T00:00:00.000Z"),
      registrationCloseAt: new Date("2026-09-19T19:00:00.000Z"),
      now,
    }),
    "open",
  );
});

test("antes de la apertura: todavía no abrió", () => {
  assert.equal(
    resolveRegistrationWindow({
      registrationEnabled: true,
      registrationOpenAt: new Date("2026-09-20T00:00:00.000Z"),
      registrationCloseAt: null,
      now,
    }),
    "not_open",
  );
});

test("después del cierre: cerrada, no 'próximamente'", () => {
  assert.equal(
    resolveRegistrationWindow({
      registrationEnabled: true,
      registrationOpenAt: new Date("2026-08-01T00:00:00.000Z"),
      registrationCloseAt: new Date("2026-09-18T22:59:00.000Z"),
      now,
    }),
    "closed",
  );
});

test("interruptor comercial apagado: no disponible", () => {
  assert.equal(
    resolveRegistrationWindow({
      registrationEnabled: false,
      registrationOpenAt: new Date("2026-08-01T00:00:00.000Z"),
      registrationCloseAt: new Date("2026-09-19T19:00:00.000Z"),
      now,
    }),
    "unavailable",
  );
});

test("sin fechas cargadas: abierta mientras el interruptor esté encendido", () => {
  assert.equal(
    resolveRegistrationWindow({
      registrationEnabled: true,
      registrationOpenAt: null,
      registrationCloseAt: null,
      now,
    }),
    "open",
  );
});

test("el instante exacto del cierre todavía cuenta como abierta", () => {
  assert.equal(
    resolveRegistrationWindow({
      registrationEnabled: true,
      registrationOpenAt: null,
      registrationCloseAt: new Date(now),
      now,
    }),
    "open",
  );
});

test("recorrido completo: la ventana vencida se lee como cerrada, no como próximamente", () => {
  const ventana = resolveRegistrationWindow({
    registrationEnabled: true,
    registrationOpenAt: new Date("2026-08-01T00:00:00.000Z"),
    registrationCloseAt: new Date("2026-09-18T23:59:00.000Z"),
    now: new Date("2026-09-19T01:41:00.000Z"),
  });
  assert.equal(ventana, "closed");

  const cta = presentRegistrationCta({
    mode: "paid",
    status: ventana,
    canRegister: false,
    displayPrice: { amountMinor: 2_500_000, currency: "ARS", formatted: "Desde $25.000 ARS" },
    hasOptionalMerchandise: false,
    registrationUrl: null,
    checkoutUrl: null,
    opensAt: null,
    closesAt: null,
    capacity: null,
    remainingSpots: null,
  });
  assert.equal(cta.headline, "Inscripción cerrada");
  assert.equal(cta.ctaEnabled, false);
});

test("recorrido completo: antes de abrir sí dice próximamente", () => {
  const ventana = resolveRegistrationWindow({
    registrationEnabled: true,
    registrationOpenAt: new Date("2026-10-01T00:00:00.000Z"),
    registrationCloseAt: null,
    now: new Date("2026-09-19T01:41:00.000Z"),
  });
  const cta = presentRegistrationCta({
    mode: "paid",
    status: ventana,
    canRegister: false,
    displayPrice: null,
    hasOptionalMerchandise: false,
    registrationUrl: null,
    checkoutUrl: null,
    opensAt: null,
    closesAt: null,
    capacity: null,
    remainingSpots: null,
  });
  assert.equal(cta.headline, "Inscripciones próximamente");
});
