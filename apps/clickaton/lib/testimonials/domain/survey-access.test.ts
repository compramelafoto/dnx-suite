import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSurveyAccess } from "./survey-access";

const participante = {
  eligible: true as const,
  role: "PARTICIPANT" as const,
  authorName: "Ana Pérez",
  authorPhotoAssetId: null,
  suggestedLinkUrl: null,
  registrationId: "reg1",
  venueId: null,
};

const rechazado = { eligible: false as const, reason: "NO_ROLE" as const };

test("un participante con el módulo encendido contesta de verdad", () => {
  const a = resolveSurveyAccess({
    moduleEnabled: true,
    eligibility: participante,
    isAdmin: false,
  });
  assert.equal(a.mode, "answer");
});

test("un admin que además participó contesta de verdad, no mira la vista previa", () => {
  const a = resolveSurveyAccess({
    moduleEnabled: true,
    eligibility: participante,
    isAdmin: true,
  });
  assert.equal(a.mode, "answer");
});

test("un admin que no participó ve la vista previa", () => {
  const a = resolveSurveyAccess({
    moduleEnabled: true,
    eligibility: rechazado,
    isAdmin: true,
  });
  assert.equal(a.mode, "preview");
});

test("un admin puede mirar aunque la encuesta esté apagada", () => {
  const a = resolveSurveyAccess({
    moduleEnabled: false,
    eligibility: rechazado,
    isAdmin: true,
  });
  assert.equal(a.mode, "preview");
  if (a.mode !== "preview") return;
  assert.equal(a.moduleEnabled, false);
});

test("alguien sin rol y sin ser admin queda afuera, con el motivo", () => {
  const a = resolveSurveyAccess({
    moduleEnabled: true,
    eligibility: rechazado,
    isAdmin: false,
  });
  assert.equal(a.mode, "denied");
  if (a.mode !== "denied") return;
  assert.equal(a.reason, "NO_ROLE");
});

test("con la encuesta apagada, quien no es admin no ve nada — ni habiendo participado", () => {
  assert.equal(
    resolveSurveyAccess({
      moduleEnabled: false,
      eligibility: participante,
      isAdmin: false,
    }).mode,
    "closed",
  );
  assert.equal(
    resolveSurveyAccess({
      moduleEnabled: false,
      eligibility: rechazado,
      isAdmin: false,
    }).mode,
    "closed",
  );
});

test("la vista previa nunca trae autor: no hay nada que guardar", () => {
  const a = resolveSurveyAccess({
    moduleEnabled: true,
    eligibility: rechazado,
    isAdmin: true,
  });
  assert.equal("author" in a, false);
});
