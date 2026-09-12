import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { test } from "node:test";
import {
  PROPOSAL_CODE_ALPHABET,
  PROPOSAL_CODE_LENGTH,
  PROPOSAL_TTL_DAYS,
  generateProposalCode,
  isProposalCode,
  isProposalExpired,
  normalizeProposalCode,
  proposalDaysLeft,
  proposalExpiryFrom,
} from "./proposal-record";

const AHORA = new Date("2026-09-10T12:00:00.000Z");

test("el alfabeto no tiene caracteres que se confundan al dictarlos", () => {
  assert.equal(PROPOSAL_CODE_ALPHABET.length, 32);
  for (const prohibido of ["0", "O", "1", "I"]) {
    assert.ok(
      !PROPOSAL_CODE_ALPHABET.includes(prohibido),
      `el alfabeto no debería incluir ${prohibido}`,
    );
  }
  // Sin repetidos: uno repetido sesgaría la distribución.
  assert.equal(new Set(PROPOSAL_CODE_ALPHABET).size, 32);
});

test("el código generado tiene la forma esperada", () => {
  const codigo = generateProposalCode((max) => randomInt(max));
  assert.match(codigo, /^PR-[2-9A-HJ-NP-Z]{6}$/);
  assert.equal(codigo.length, 3 + PROPOSAL_CODE_LENGTH);
  assert.ok(isProposalCode(codigo));
});

test("el generador usa todo el alfabeto y no solo el principio", () => {
  let i = 0;
  const codigo = generateProposalCode(() => {
    const indice = i;
    i += 1;
    return indice;
  });
  assert.equal(codigo, `PR-${PROPOSAL_CODE_ALPHABET.slice(0, 6)}`);

  const ultimo = generateProposalCode(() => PROPOSAL_CODE_ALPHABET.length - 1);
  assert.equal(codigo === ultimo, false);
  assert.equal(ultimo, "PR-ZZZZZZ");
});

test("un aleatorio fuera de rango falla en vez de producir un código roto", () => {
  // Preferible fallar a devolver un código con un hueco, que la base guardaría
  // igual y nadie podría volver a tipear.
  assert.throws(() => generateProposalCode(() => 99), /fuera de rango/);
  assert.throws(() => generateProposalCode(() => 1.5), /fuera de rango/);
  assert.throws(() => generateProposalCode(() => -1), /fuera de rango/);
});

test("normalizar tolera cómo lo copia una persona", () => {
  assert.equal(normalizeProposalCode("pr-4f2akx"), "PR-4F2AKX");
  assert.equal(normalizeProposalCode("  PR-4F2AKX  "), "PR-4F2AKX");
  assert.equal(normalizeProposalCode("4F2AKX"), "PR-4F2AKX");
  assert.equal(normalizeProposalCode("PR 4F2AKX"), "PR-4F2AKX");
  assert.equal(normalizeProposalCode("PR--4F2AKX"), "PR-4F2AKX");
});

test("un cuerpo que arranca con PR se lee igual sin prefijo", () => {
  // `P` y `R` están en el alfabeto: sin probar las dos lecturas, este código
  // válido quedaría rechazado.
  assert.equal(normalizeProposalCode("PRQ7XZ"), "PR-PRQ7XZ");
  assert.equal(normalizeProposalCode("PR-PRQ7XZ"), "PR-PRQ7XZ");
});

test("normalizar no adivina los caracteres que el alfabeto evita", () => {
  // Una `O` no se convierte en `0`: aceptarla sería abrir la propuesta de otro.
  assert.equal(normalizeProposalCode("PR-4F2AKO"), null);
  assert.equal(normalizeProposalCode("PR-4F2AK0"), null);
  assert.equal(normalizeProposalCode("PR-4F2AK"), null);
  assert.equal(normalizeProposalCode("PR-4F2AKXY"), null);
  assert.equal(normalizeProposalCode(""), null);
  assert.equal(normalizeProposalCode(null), null);
  assert.equal(normalizeProposalCode(undefined), null);
});

test("el vencimiento por defecto son treinta días", () => {
  const vence = proposalExpiryFrom(AHORA);
  const dias = (vence.getTime() - AHORA.getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(dias, PROPOSAL_TTL_DAYS);
  assert.equal(dias, 30);
});

test("una propuesta vence por fecha aunque siga figurando lista", () => {
  const vencida = { status: "READY" as const, expiresAt: new Date("2026-09-09T00:00:00.000Z") };
  assert.equal(isProposalExpired(vencida, AHORA), true);

  const vigente = { status: "READY" as const, expiresAt: new Date("2026-09-11T00:00:00.000Z") };
  assert.equal(isProposalExpired(vigente, AHORA), false);
});

test("el vencimiento es inclusivo: al llegar la hora ya no se abre", () => {
  const justo = { status: "READY" as const, expiresAt: new Date(AHORA) };
  assert.equal(isProposalExpired(justo, AHORA), true);
});

test("una convertida no vence, pero una marcada vencida no revive", () => {
  const convertida = {
    status: "CONVERTED" as const,
    expiresAt: new Date("2020-01-01T00:00:00.000Z"),
  };
  assert.equal(isProposalExpired(convertida, AHORA), false);

  const marcada = { status: "EXPIRED" as const, expiresAt: new Date("2099-01-01T00:00:00.000Z") };
  assert.equal(isProposalExpired(marcada, AHORA), true);
});

test("los días restantes se redondean hacia arriba y nunca son negativos", () => {
  assert.equal(
    proposalDaysLeft({ status: "READY", expiresAt: proposalExpiryFrom(AHORA) }, AHORA),
    30,
  );
  assert.equal(
    proposalDaysLeft(
      { status: "READY", expiresAt: new Date("2026-09-10T12:00:01.000Z") },
      AHORA,
    ),
    1,
  );
  assert.equal(
    proposalDaysLeft({ status: "READY", expiresAt: new Date("2020-01-01T00:00:00.000Z") }, AHORA),
    0,
  );
});
