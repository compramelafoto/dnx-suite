import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  describeSharedGift,
  EXTERNAL_SHARED_GIFT_LINK_KIND,
  parseSharedGiftLinkRefs,
  validateFamilyData,
} from "./shared-voucher-link";
import { parseExternalVoucherRefs } from "./external-voucher";

const ok = {
  parentName: "  María   Pérez ",
  studentName: "Juan Pérez",
  email: " Maria@Hotmail.com ",
  phone: "(0341) 15 555-1234",
};

describe("validateFamilyData", () => {
  it("acepta datos completos y normaliza email y WhatsApp", () => {
    const r = validateFamilyData({ ...ok, phone: "341 555 1234" });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.parentName, "María Pérez");
    assert.equal(r.data.email, "maria@hotmail.com");
    assert.equal(r.data.phoneWhatsApp, "5493415551234");
  });

  it("exige nombre y apellido del adulto y de quien aparece en las fotos", () => {
    assert.equal(validateFamilyData({ ...ok, parentName: "María" }).ok, false);
    assert.equal(validateFamilyData({ ...ok, studentName: "Juan" }).ok, false);
  });

  it("rechaza email o WhatsApp inválidos", () => {
    assert.equal(validateFamilyData({ ...ok, email: "maria@" }).ok, false);
    assert.equal(validateFamilyData({ ...ok, phone: "5551234" }).ok, false);
    assert.equal(validateFamilyData({}).ok, false);
  });
});

describe("refs del link compartido", () => {
  it("se lee sólo con su kind y no pasa por combo de familia", () => {
    const raw = { kind: EXTERNAL_SHARED_GIFT_LINK_KIND, printUnits: 3, size: "15x20", includesDigital: false, label: "x" };
    assert.deepEqual(parseSharedGiftLinkRefs(raw)?.printUnits, 3);
    assert.equal(parseExternalVoucherRefs(raw), null);
    assert.equal(parseSharedGiftLinkRefs({ ...raw, kind: "EXTERNAL_PREPAID_PRINT_CREDIT" }), null);
    assert.equal(parseSharedGiftLinkRefs({ ...raw, printUnits: 0 }), null);
  });

  it("describe el regalo", () => {
    assert.equal(describeSharedGift(3, "15x20 cm", false), "3 fotos impresas 15x20 de regalo");
    assert.equal(describeSharedGift(1, "15x20", true), "1 foto impresa 15x20 con su digital de regalo");
  });

  it("el combo de la familia conserva la marca de regalo", () => {
    const refs = parseExternalVoucherRefs({
      kind: "EXTERNAL_PREPAID_PRINT_CREDIT",
      printUnits: 3,
      size: "15x20",
      isGift: true,
    });
    assert.equal(refs?.isGift, true);
  });
});
