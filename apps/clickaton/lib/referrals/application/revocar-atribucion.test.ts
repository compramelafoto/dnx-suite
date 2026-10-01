import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryReferralRepository } from "../infrastructure/in-memory-referral-repository";
import { atribuirReferido } from "./atribuir-referido";
import { debeRevocarPorEstadoDePago, revocarAtribucionPorPago } from "./revocar-atribucion";

const JUAN = 10;
const ANA = 20;

async function conUnaAtribucion() {
  const { repo, inspect } = createInMemoryReferralRepository({
    codes: [{ id: "code-juan", userId: JUAN, code: "CK-7F3K2", isActive: true }],
    emails: { [JUAN]: "juan@ejemplo.com", [ANA]: "ana@ejemplo.com" },
    confirmados: [JUAN],
  });
  await atribuirReferido(repo, {
    code: "CK-7F3K2",
    referredUserId: ANA,
    referredEmail: "ana@ejemplo.com",
    registrationId: "reg-ana-1",
    editionId: "ed-2",
  });
  return { repo, inspect };
}

test("un pago revertido baja el contador", async () => {
  const { repo } = await conUnaAtribucion();
  assert.equal(await repo.contarColegasTraidos(JUAN), 1);

  await revocarAtribucionPorPago(repo, {
    registrationId: "reg-ana-1",
    reason: "payment_refunded",
  });

  assert.equal(await repo.contarColegasTraidos(JUAN), 0);
});

test("la revocación queda auditada con su motivo", async () => {
  const { repo, inspect } = await conUnaAtribucion();
  await revocarAtribucionPorPago(repo, {
    registrationId: "reg-ana-1",
    reason: "payment_chargeback",
  });

  const atribucion = inspect().attributions[0]!;
  assert.equal(atribucion.status, "REVOKED");
  assert.equal(atribucion.revokedReason, "payment_chargeback");
  assert.ok(atribucion.revokedAt);
});

test("revocar una inscripción sin atribución no rompe nada", async () => {
  const { repo } = await conUnaAtribucion();
  const r = await revocarAtribucionPorPago(repo, {
    registrationId: "reg-que-no-existe",
    reason: "payment_refunded",
  });
  assert.equal(r.revocada, false);
});

test("revocar dos veces es inofensivo", async () => {
  const { repo } = await conUnaAtribucion();
  await revocarAtribucionPorPago(repo, { registrationId: "reg-ana-1", reason: "x" });
  const segunda = await revocarAtribucionPorPago(repo, {
    registrationId: "reg-ana-1",
    reason: "x",
  });
  assert.equal(segunda.revocada, false);
  assert.equal(await repo.contarColegasTraidos(JUAN), 0);
});

test("si Ana vuelve a pagar de verdad, puede volver a contar", async () => {
  // La revocación libera el único de referredUserId a través del status.
  const { repo } = await conUnaAtribucion();
  await revocarAtribucionPorPago(repo, { registrationId: "reg-ana-1", reason: "x" });

  const r = await atribuirReferido(repo, {
    code: "CK-7F3K2",
    referredUserId: ANA,
    referredEmail: "ana@ejemplo.com",
    registrationId: "reg-ana-2",
    editionId: "ed-2",
  });

  assert.equal(r.outcome, "CREATED");
  assert.equal(await repo.contarColegasTraidos(JUAN), 1);
});

test("un pago caído revoca", () => {
  assert.equal(debeRevocarPorEstadoDePago("REFUNDED"), true);
  assert.equal(debeRevocarPorEstadoDePago("CANCELLED"), true);
  assert.equal(debeRevocarPorEstadoDePago("EXPIRED"), true);
  assert.equal(debeRevocarPorEstadoDePago("FAILED"), true);
});

test("un pago que sigue vivo NO revoca", () => {
  assert.equal(debeRevocarPorEstadoDePago("APPROVED"), false);
  assert.equal(debeRevocarPorEstadoDePago("PENDING"), false);
  assert.equal(debeRevocarPorEstadoDePago("PROCESSING"), false);
  assert.equal(debeRevocarPorEstadoDePago("NOT_REQUIRED"), false);
  // Revisión manual no es una caída: alguien va a mirarlo.
  assert.equal(debeRevocarPorEstadoDePago("MANUAL_REVIEW"), false);
});

test("un reembolso parcial NO revoca: el colega vino y pagó", () => {
  // Ante la duda, a favor de quien hizo el trabajo de traerlo.
  assert.equal(debeRevocarPorEstadoDePago("PARTIALLY_REFUNDED"), false);
});
