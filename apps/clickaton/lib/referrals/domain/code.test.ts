import assert from "node:assert/strict";
import test from "node:test";

import {
  REFERRAL_CODE_ALPHABET,
  generateReferralCode,
  normalizeReferralCode,
} from "./code";

test("el código generado tiene la forma CK-XXXXX", () => {
  const code = generateReferralCode();
  assert.match(code, /^CK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
});

test("el alfabeto no tiene caracteres que se confundan al dictarlos", () => {
  for (const char of "01OIL") {
    assert.ok(!REFERRAL_CODE_ALPHABET.includes(char), `${char} no debe estar`);
  }
});

test("dos códigos seguidos no son iguales", () => {
  const vistos = new Set<string>();
  for (let i = 0; i < 200; i += 1) vistos.add(generateReferralCode());
  assert.equal(vistos.size, 200);
});

test("acepta lo que la gente pega: minúsculas, espacios, sin prefijo", () => {
  const code = generateReferralCode();
  const cuerpo = code.slice(3);
  assert.equal(normalizeReferralCode(code.toLowerCase()), code);
  assert.equal(normalizeReferralCode(`  ${code}  `), code);
  assert.equal(normalizeReferralCode(cuerpo), code);
});

test("corrige los caracteres que la gente tipea mal", () => {
  // Nadie distingue O de 0 leyendo una pantalla; como el alfabeto no los
  // contiene, corregirlos no puede pisar un código real.
  assert.equal(normalizeReferralCode("CK-Q2345"), normalizeReferralCode("CK-O2345"));
  assert.equal(normalizeReferralCode("CK-J2345"), normalizeReferralCode("CK-12345"));
});

test("rechaza lo que no es un código", () => {
  assert.equal(normalizeReferralCode(""), null);
  assert.equal(normalizeReferralCode("CK-123"), null, "muy corto");
  assert.equal(normalizeReferralCode("CK-234567"), null, "muy largo");
  assert.equal(normalizeReferralCode("CK-@#$%^"), null, "fuera del alfabeto");
});
