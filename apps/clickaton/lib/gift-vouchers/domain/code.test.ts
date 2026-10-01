import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateGiftVoucherCode,
  normalizeGiftVoucherCode,
  GIFT_VOUCHER_CODE_ALPHABET,
} from "./code";

describe("código de voucher de regalo", () => {
  it("genera el formato REGALO-XXXX-XXXX", () => {
    const code = generateGiftVoucherCode();
    assert.match(code, /^REGALO-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  });

  it("no usa caracteres ambiguos", () => {
    for (const ambiguous of ["0", "O", "1", "I", "L"]) {
      assert.equal(GIFT_VOUCHER_CODE_ALPHABET.includes(ambiguous), false);
    }
  });

  it("genera códigos distintos en llamadas sucesivas", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) seen.add(generateGiftVoucherCode());
    assert.equal(seen.size, 200);
  });

  it("normaliza mayúsculas, espacios y guiones faltantes", () => {
    assert.equal(normalizeGiftVoucherCode(" regalo-7k3m-9qx2 "), "REGALO-7K3M-9QX2");
    assert.equal(normalizeGiftVoucherCode("REGALO7K3M9QX2"), "REGALO-7K3M-9QX2");
    assert.equal(normalizeGiftVoucherCode("7K3M9QX2"), "REGALO-7K3M-9QX2");
  });

  it("corrige caracteres ambiguos que la gente tipea", () => {
    assert.equal(normalizeGiftVoucherCode("REGALO-O0IL-9QX2"), "REGALO-QQJJ-9QX2");
  });

  it("rechaza lo que no es un código", () => {
    assert.equal(normalizeGiftVoucherCode(""), null);
    assert.equal(normalizeGiftVoucherCode("REGALO-123"), null);
    assert.equal(normalizeGiftVoucherCode("REGALO-7K3M-9QX2-EXTRA"), null);
  });
});
