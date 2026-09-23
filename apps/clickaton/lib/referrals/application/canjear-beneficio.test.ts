import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryReferralRepository } from "../infrastructure/in-memory-referral-repository";
import {
  adjuntarReservaAInscripcion,
  confirmarCanje,
  liberarCanje,
  reservarBeneficio,
} from "./canjear-beneficio";

const JUAN = 10;
const PRECIO = 3_500_000; // $35.000

/** Juan trajo `n` colegas, todos con pago aprobado. */
function conColegas(n: number) {
  return createInMemoryReferralRepository({
    codes: [{ id: "code-juan", userId: JUAN, code: "CK-7F3K2", isActive: true }],
    emails: { [JUAN]: "juan@ejemplo.com" },
    confirmados: [JUAN],
    attributions: Array.from({ length: n }, (_, i) => ({
      id: `attr-${i}`,
      referrerUserId: JUAN,
      referredUserId: 100 + i,
      referredEmail: `colega${i}@ejemplo.com`,
      referralCodeId: "code-juan",
      registrationId: `reg-colega-${i}`,
      editionId: "ed-2",
      status: "EARNED" as const,
      earnedAt: new Date("2026-09-01T12:00:00Z"),
      revokedAt: null,
      revokedReason: null,
      consumedAt: null,
      consumedRegistrationId: null,
    })),
  });
}

test("sin colegas no hay descuento y no se reserva nada", async () => {
  const { repo } = conColegas(0);
  const r = await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-juan-nueva",
  });

  assert.equal(r.gana, "ninguno");
  assert.equal(r.montoFinal, PRECIO);
  assert.equal(r.colegasReservados, 0);
});

test("con dos colegas se aplica el 20% y quedan reservados", async () => {
  const { repo } = conColegas(2);
  const r = await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-juan-nueva",
  });

  assert.equal(r.gana, "referidos");
  assert.equal(r.montoFinal, 2_800_000);
  assert.equal(r.colegasReservados, 2);
  assert.equal(await repo.contarColegasTraidos(JUAN), 0, "ya no están disponibles");
});

test("reservar bloquea una segunda inscripción simultánea", async () => {
  // Sin esto, dos pestañas abiertas entran las dos con descuento.
  const { repo } = conColegas(5);
  const primera = await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-a",
  });
  const segunda = await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-b",
  });

  assert.equal(primera.montoFinal, 0, "la primera entra gratis");
  assert.equal(segunda.montoFinal, PRECIO, "la segunda paga todo");
});

test("si gana el cupón NO se reserva nada: los colegas quedan intactos", async () => {
  const { repo } = conColegas(1); // 10%
  const r = await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: { descuento: 1_750_000 }, // 50%
    ref: "reg-juan-nueva",
  });

  assert.equal(r.gana, "cupon");
  assert.equal(r.colegasReservados, 0);
  assert.equal(await repo.contarColegasTraidos(JUAN), 1, "su colega sigue ahí");
});

test("con cinco colegas la inscripción queda en cero", async () => {
  const { repo } = conColegas(5);
  const r = await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-juan-nueva",
  });
  assert.equal(r.montoFinal, 0);
  assert.equal(r.colegasReservados, 5);
});

test("con siete colegas se usan cinco y sobran dos para la próxima", async () => {
  const { repo } = conColegas(7);
  const r = await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-juan-nueva",
  });

  assert.equal(r.colegasReservados, 5);
  assert.equal(await repo.contarColegasTraidos(JUAN), 2);
});

test("sin sesión (invitado sin cuenta) no hay beneficio", async () => {
  const { repo } = conColegas(3);
  const r = await reservarBeneficio(repo, {
    userId: null,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-invitado",
  });
  assert.equal(r.gana, "ninguno");
  assert.equal(r.montoFinal, PRECIO);
});

test("sobre una entrada gratuita no se queman colegas", async () => {
  const { repo } = conColegas(5);
  const r = await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: 0,
    cupon: null,
    ref: "reg-gratis",
  });

  assert.equal(r.colegasReservados, 0);
  assert.equal(await repo.contarColegasTraidos(JUAN), 5);
});

test("al pagarse, la reserva se convierte en consumo definitivo", async () => {
  const { repo, inspect } = conColegas(2);
  await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-juan-nueva",
  });

  const r = await confirmarCanje(repo, { registrationId: "reg-juan-nueva" });

  assert.equal(r.consumidos, 2);
  assert.equal(await repo.contarColegasTraidos(JUAN), 0, "no vuelven");
  const usadas = inspect().attributions.filter((a) => a.status === "CONSUMED");
  assert.equal(usadas.length, 2);
  assert.ok(usadas.every((a) => a.consumedRegistrationId === "reg-juan-nueva"));
});

test("si la reserva vence, los colegas vuelven a estar disponibles", async () => {
  const { repo } = conColegas(3);
  await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-juan-nueva",
  });
  assert.equal(await repo.contarColegasTraidos(JUAN), 0);

  const r = await liberarCanje(repo, { registrationId: "reg-juan-nueva" });

  assert.equal(r.liberados, 3);
  assert.equal(await repo.contarColegasTraidos(JUAN), 3, "vuelven enteros");
});

test("liberar algo ya consumido no devuelve nada", async () => {
  // El pago entró: no se le puede sacar el descuento y devolverle los colegas.
  const { repo } = conColegas(2);
  await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-juan-nueva",
  });
  await confirmarCanje(repo, { registrationId: "reg-juan-nueva" });

  const r = await liberarCanje(repo, { registrationId: "reg-juan-nueva" });
  assert.equal(r.liberados, 0);
  assert.equal(await repo.contarColegasTraidos(JUAN), 0);
});

test("confirmar o liberar una inscripción sin reserva es inofensivo", async () => {
  const { repo } = conColegas(2);
  assert.equal((await confirmarCanje(repo, { registrationId: "otra" })).consumidos, 0);
  assert.equal((await liberarCanje(repo, { registrationId: "otra" })).liberados, 0);
  assert.equal(await repo.contarColegasTraidos(JUAN), 2);
});

test("el flujo real: se reserva contra la clave y después se mueve a la inscripción", async () => {
  // Al calcular el precio la inscripción todavía no existe, así que la
  // reserva nace atada a la clave de idempotencia.
  const { repo } = conColegas(3);
  await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "idem:abc-123",
  });

  const movidas = await adjuntarReservaAInscripcion(repo, {
    ref: "idem:abc-123",
    registrationId: "reg-juan-real",
  });
  assert.equal(movidas.adjuntados, 3);

  // Recién ahora se puede confirmar por id de inscripción.
  assert.equal((await confirmarCanje(repo, { registrationId: "reg-juan-real" })).consumidos, 3);
});

test("una reserva sin adjuntar no se confirma por id de inscripción", async () => {
  const { repo } = conColegas(2);
  await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "idem:huerfana",
  });

  assert.equal((await confirmarCanje(repo, { registrationId: "reg-x" })).consumidos, 0);
  // Y los colegas siguen tomados: se liberan por su propia clave.
  assert.equal(await repo.contarColegasTraidos(JUAN), 0);
  assert.equal((await liberarCanje(repo, { registrationId: "idem:huerfana" })).liberados, 2);
  assert.equal(await repo.contarColegasTraidos(JUAN), 2);
});

test("confirmar dos veces no consume de más", async () => {
  const { repo } = conColegas(2);
  await reservarBeneficio(repo, {
    userId: JUAN,
    montoOriginal: PRECIO,
    cupon: null,
    ref: "reg-juan-nueva",
  });
  await confirmarCanje(repo, { registrationId: "reg-juan-nueva" });
  const segunda = await confirmarCanje(repo, { registrationId: "reg-juan-nueva" });

  assert.equal(segunda.consumidos, 0);
});
