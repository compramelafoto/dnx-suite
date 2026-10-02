import assert from "node:assert/strict";
import test from "node:test";

import {
  commissionStatusLabel,
  consentStatusLabel,
  formatCommissionBps,
  normalizeAffiliateConsentStatus,
} from "./labels";

test("normaliza el estado de la vinculación", () => {
  assert.equal(normalizeAffiliateConsentStatus(null), "NONE");
  assert.equal(normalizeAffiliateConsentStatus(""), "NONE");
  assert.equal(normalizeAffiliateConsentStatus("active"), "ACTIVE");
  assert.equal(normalizeAffiliateConsentStatus(" Expired "), "EXPIRED");
});

test("un estado desconocido nunca es activo", () => {
  assert.equal(normalizeAffiliateConsentStatus("RARO"), "PENDING");
});

test("textos de estados", () => {
  assert.equal(commissionStatusLabel("OWED"), "A transferir");
  assert.equal(commissionStatusLabel("OTRO"), "OTRO");
  assert.equal(consentStatusLabel(undefined), "Sin invitar");
});

test("porcentaje desde puntos básicos", () => {
  assert.equal(formatCommissionBps(1000), "10%");
  assert.equal(formatCommissionBps(1250), "12,5%");
});
