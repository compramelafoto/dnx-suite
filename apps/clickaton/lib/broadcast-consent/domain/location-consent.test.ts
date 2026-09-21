import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLocationConsent,
  type LocationConsentChoices,
} from "./location-consent";
import { CLICKATON_LOCATION_CONSENT_VERSION } from "../content/location-consent-copy";

const AHORA = new Date("2026-10-01T12:00:00.000Z");
const ANTES = new Date("2026-09-25T10:00:00.000Z");
const EVENTO = new Date("2026-12-12T15:00:00.000Z");

const NINGUNA: LocationConsentChoices = {
  personal: false,
  publicMap: false,
  interview: false,
  declaredAdult: false,
};

const VACIO = {
  locationConsentAt: null,
  locationPublicConsentAt: null,
  interviewConsentAt: null,
  locationConsentVersion: null,
};

test("sin ninguna casilla marcada no guarda ningún consentimiento", () => {
  const r = resolveLocationConsent({
    choices: NINGUNA,
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r, VACIO);
});

test("la casilla personal sola guarda fecha y versión", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r.locationConsentAt, AHORA);
  assert.equal(r.locationPublicConsentAt, null);
  assert.equal(r.interviewConsentAt, null);
  assert.equal(r.locationConsentVersion, CLICKATON_LOCATION_CONSENT_VERSION);
});

test("la casilla del mapa público no vale sin la personal", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, publicMap: true, declaredAdult: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.equal(r.locationPublicConsentAt, null);
});

test("la casilla del mapa público no vale sin declarar mayoría de edad", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r.locationConsentAt, AHORA);
  assert.equal(r.locationPublicConsentAt, null);
});

test("con personal, mapa público y mayoría declarada guarda las dos fechas", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true, declaredAdult: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r.locationConsentAt, AHORA);
  assert.deepEqual(r.locationPublicConsentAt, AHORA);
});

test("un menor por fecha de nacimiento nunca entra al mapa público", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true, declaredAdult: true },
    birthDate: new Date("2012-01-01T00:00:00.000Z"),
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.deepEqual(r.locationConsentAt, AHORA);
  assert.equal(r.locationPublicConsentAt, null);
});

test("la casilla de entrevista es independiente de las otras dos", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, interview: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.equal(r.locationConsentAt, null);
  assert.deepEqual(r.interviewConsentAt, AHORA);
  assert.equal(r.locationConsentVersion, CLICKATON_LOCATION_CONSENT_VERSION);
});

test("revocar la personal también revoca el mapa público", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, publicMap: true, declaredAdult: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
    previous: {
      locationConsentAt: ANTES,
      locationPublicConsentAt: ANTES,
      interviewConsentAt: null,
      locationConsentVersion: CLICKATON_LOCATION_CONSENT_VERSION,
    },
  });
  assert.equal(r.locationConsentAt, null);
  assert.equal(r.locationPublicConsentAt, null);
});

test("un consentimiento ya otorgado conserva su fecha original", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, interview: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
    previous: {
      locationConsentAt: ANTES,
      locationPublicConsentAt: null,
      interviewConsentAt: null,
      locationConsentVersion: CLICKATON_LOCATION_CONSENT_VERSION,
    },
  });
  assert.deepEqual(r.locationConsentAt, ANTES, "no se pisa la fecha original");
  assert.deepEqual(r.interviewConsentAt, AHORA, "la nueva sí toma el ahora");
});
