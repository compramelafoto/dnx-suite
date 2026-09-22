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
const NACIMIENTO_MENOR = new Date("2012-01-01T00:00:00.000Z");

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
  locationConsentDeclaredAdult: false,
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
      locationConsentDeclaredAdult: true,
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
      locationConsentDeclaredAdult: false,
    },
  });
  assert.deepEqual(r.locationConsentAt, ANTES, "no se pisa la fecha original");
  assert.deepEqual(r.interviewConsentAt, AHORA, "la nueva sí toma el ahora");
});

test("si cambió la versión del texto legal, la fecha se renueva en vez de conservarse", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, interview: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
    previous: {
      locationConsentAt: ANTES,
      locationPublicConsentAt: null,
      interviewConsentAt: ANTES,
      // Versión anterior a la vigente: alguien que consintió esa versión no
      // consintió automáticamente la nueva, así que la fecha no puede seguir
      // afirmando que aceptó un texto que todavía no existía.
      locationConsentVersion: "CLICKATON_LOCATION_2026_09_v0",
      locationConsentDeclaredAdult: false,
    },
  });
  assert.deepEqual(r.locationConsentAt, AHORA, "cambió de versión: se renueva");
  assert.deepEqual(r.interviewConsentAt, AHORA, "cambió de versión: se renueva");
  assert.equal(r.locationConsentVersion, CLICKATON_LOCATION_CONSENT_VERSION);
});

test("sin cambio de versión, la fecha original se sigue conservando", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
    previous: {
      locationConsentAt: ANTES,
      locationPublicConsentAt: null,
      interviewConsentAt: null,
      locationConsentVersion: CLICKATON_LOCATION_CONSENT_VERSION,
      locationConsentDeclaredAdult: false,
    },
  });
  assert.deepEqual(r.locationConsentAt, ANTES);
});

test("la declaración de mayoría de edad es pegajosa: no se pierde al desmarcar el mapa público", () => {
  const r = resolveLocationConsent({
    // Ahora desmarca el mapa público (y por lo tanto no lo declara de nuevo).
    choices: { ...NINGUNA, personal: true, publicMap: false, declaredAdult: false },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
    previous: {
      locationConsentAt: ANTES,
      locationPublicConsentAt: ANTES,
      interviewConsentAt: null,
      locationConsentVersion: CLICKATON_LOCATION_CONSENT_VERSION,
      locationConsentDeclaredAdult: true,
    },
  });
  assert.equal(
    r.locationConsentDeclaredAdult,
    true,
    "una vez declarada, la mayoría de edad queda declarada",
  );
});

test("declarar mayoría de edad por primera vez la deja guardada", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true, declaredAdult: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.equal(r.locationConsentDeclaredAdult, true);
});

// --- Menores (diseño §5.2): "Las casillas 1 y 3 requieren el consentimiento
// del adulto responsable." ---

test("un menor SIN autorización del adulto responsable no obtiene ninguna casilla", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true, interview: true, declaredAdult: true },
    birthDate: NACIMIENTO_MENOR,
    eventDate: EVENTO,
    now: AHORA,
  });
  assert.equal(r.locationConsentAt, null, "sin autorización, ni la personal");
  assert.equal(r.locationPublicConsentAt, null);
  assert.equal(r.interviewConsentAt, null, "sin autorización, ni la entrevista");
  assert.equal(r.locationConsentVersion, null);
});

test("un menor CON autorización del adulto responsable obtiene la personal y la entrevista, nunca el mapa público", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true, interview: true, declaredAdult: true },
    birthDate: NACIMIENTO_MENOR,
    eventDate: EVENTO,
    now: AHORA,
    adultResponsible: {
      name: "Adulto Responsable",
      authorizedAt: ANTES,
    },
  });
  assert.deepEqual(r.locationConsentAt, AHORA, "con autorización, la personal sí");
  assert.deepEqual(r.interviewConsentAt, AHORA, "con autorización, la entrevista sí");
  assert.equal(r.locationPublicConsentAt, null, "el mapa público nunca, ni con autorización");
});

test("cuando no es menor, los datos del adulto responsable no cambian nada", () => {
  const r = resolveLocationConsent({
    choices: { ...NINGUNA, personal: true, publicMap: true, declaredAdult: true },
    birthDate: null,
    eventDate: EVENTO,
    now: AHORA,
    adultResponsible: { name: "Alguien", authorizedAt: ANTES },
  });
  assert.deepEqual(r.locationConsentAt, AHORA);
  assert.deepEqual(r.locationPublicConsentAt, AHORA);
});
