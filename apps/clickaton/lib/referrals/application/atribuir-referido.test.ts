import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryReferralRepository } from "../infrastructure/in-memory-referral-repository";
import { atribuirReferido } from "./atribuir-referido";

const JUAN = 10;
const ANA = 20;

function escenario(overrides: Parameters<typeof createInMemoryReferralRepository>[0] = {}) {
  return createInMemoryReferralRepository({
    codes: [{ id: "code-juan", userId: JUAN, code: "CK-7F3K2", isActive: true }],
    emails: { [JUAN]: "juan@ejemplo.com", [ANA]: "ana@ejemplo.com" },
    confirmados: [JUAN],
    ...overrides,
  });
}

const ENTRADA = {
  code: "CK-7F3K2",
  referredUserId: ANA,
  referredEmail: "ana@ejemplo.com",
  registrationId: "reg-ana-1",
  editionId: "ed-2",
};

test("el caso feliz: se crea la atribución y el contador sube a 1", async () => {
  const { repo } = escenario();
  const r = await atribuirReferido(repo, ENTRADA);

  assert.equal(r.outcome, "CREATED");
  assert.equal(await repo.contarColegasTraidos(JUAN), 1);
});

test("el código se normaliza: el link puede venir en minúscula", async () => {
  const { repo } = escenario();
  const r = await atribuirReferido(repo, { ...ENTRADA, code: "ck-7f3k2" });
  assert.equal(r.outcome, "CREATED");
});

test("un código inexistente no atribuye y no explota", async () => {
  const { repo, inspect } = escenario();
  const r = await atribuirReferido(repo, { ...ENTRADA, code: "CK-ZZZZZ" });

  assert.equal(r.outcome, "CODE_NOT_FOUND");
  assert.equal(await repo.contarColegasTraidos(JUAN), 0);
  assert.equal(inspect().attempts.at(-1)?.outcome, "CODE_NOT_FOUND");
});

test("todo intento queda registrado, incluso el que no prosperó", async () => {
  // En CompraMeLaFoto se descartaban en silencio y fue imposible auditarlos.
  const { repo, inspect } = escenario();
  await atribuirReferido(repo, { ...ENTRADA, referredUserId: JUAN });

  const intento = inspect().attempts.at(-1);
  assert.equal(intento?.outcome, "SELF_REFERRAL");
  assert.equal(intento?.code, "CK-7F3K2");
  assert.equal(intento?.registrationId, "reg-ana-1");
});

test("el intento exitoso también se registra", async () => {
  const { repo, inspect } = escenario();
  await atribuirReferido(repo, ENTRADA);
  assert.equal(inspect().attempts.at(-1)?.outcome, "CREATED");
});

test("nadie se refiere a sí mismo, ni con otra cuenta y el mismo email", async () => {
  const { repo } = escenario({
    emails: { [JUAN]: "juan@ejemplo.com", 99: "juan@ejemplo.com" },
  });
  const r = await atribuirReferido(repo, {
    ...ENTRADA,
    referredUserId: 99,
    referredEmail: "juan@ejemplo.com",
  });
  assert.equal(r.outcome, "SAME_EMAIL");
  assert.equal(await repo.contarColegasTraidos(JUAN), 0);
});

test("quien nunca participó también puede invitar", async () => {
  // El invitado tiene que pagar para contar, así que abrirlo a todos no
  // regala nada: quien trae cinco personas que pagan se ganó su Clickatón,
  // haya venido antes o no.
  const { repo } = escenario({ confirmados: [] });
  const r = await atribuirReferido(repo, ENTRADA);

  assert.equal(r.outcome, "CREATED");
  assert.equal(await repo.contarColegasTraidos(JUAN), 1);
});

test("cada persona cuenta una sola vez en su vida", async () => {
  const { repo } = escenario();
  await atribuirReferido(repo, ENTRADA);

  // Ana vuelve sola en la edición siguiente, con otro link.
  const r = await atribuirReferido(repo, {
    ...ENTRADA,
    registrationId: "reg-ana-2",
    editionId: "ed-3",
  });

  assert.equal(r.outcome, "ALREADY_ATTRIBUTED");
  assert.equal(await repo.contarColegasTraidos(JUAN), 1, "el contador no sube dos veces");
});

test("es idempotente: el mismo pago procesado dos veces atribuye una sola vez", async () => {
  // Los tres caminos que confirman un pago pueden pisarse entre sí.
  const { repo } = escenario();
  const primera = await atribuirReferido(repo, ENTRADA);
  const segunda = await atribuirReferido(repo, ENTRADA);

  assert.equal(primera.outcome, "CREATED");
  assert.equal(segunda.outcome, "CREATED", "reporta el mismo resultado");
  assert.equal(segunda.yaExistia, true);
  assert.equal(await repo.contarColegasTraidos(JUAN), 1);
});

test("sin código no hace nada: la mayoría de las inscripciones no vienen referidas", async () => {
  const { repo, inspect } = escenario();
  const r = await atribuirReferido(repo, { ...ENTRADA, code: "" });

  assert.equal(r.outcome, "CODE_NOT_FOUND");
  assert.equal(inspect().attempts.length, 0, "no ensucia la auditoría");
});

test("sin usuario del referido no se atribuye", async () => {
  // La inscripción puede hacerse como invitado; si la identidad no se pudo
  // materializar, no hay a quién atribuirle.
  const { repo } = escenario();
  const r = await atribuirReferido(repo, { ...ENTRADA, referredUserId: null });
  assert.equal(r.outcome, "ERROR");
});
