import assert from "node:assert/strict";
import test from "node:test";

import { CLICKATON_LOCATION_CONSENT_VERSION } from "@/lib/broadcast-consent/content/location-consent-copy";

import {
  crearEscenario,
  inscribir,
} from "./location-consent-funnel.fixture";

test("una inscripción sin casillas de ubicación no guarda consentimiento", async () => {
  const esc = crearEscenario();
  const reg = await inscribir(esc, {});
  assert.equal(reg.locationConsentAt, null);
  assert.equal(reg.locationPublicConsentAt, null);
  assert.equal(reg.interviewConsentAt, null);
  assert.equal(reg.locationConsentVersion, null);
});

test("una inscripción con las tres casillas guarda las tres fechas y la versión", async () => {
  const esc = crearEscenario();
  const reg = await inscribir(esc, {
    locationConsent: true,
    locationPublicConsent: true,
    interviewConsent: true,
    locationDeclaredAdult: true,
  });
  assert.notEqual(reg.locationConsentAt, null);
  assert.notEqual(reg.locationPublicConsentAt, null);
  assert.notEqual(reg.interviewConsentAt, null);
  assert.equal(reg.locationConsentVersion, CLICKATON_LOCATION_CONSENT_VERSION);
});

test("el mapa público no se guarda si no se declaró mayoría de edad", async () => {
  const esc = crearEscenario();
  const reg = await inscribir(esc, {
    locationConsent: true,
    locationPublicConsent: true,
  });
  assert.notEqual(reg.locationConsentAt, null);
  assert.equal(reg.locationPublicConsentAt, null);
});
