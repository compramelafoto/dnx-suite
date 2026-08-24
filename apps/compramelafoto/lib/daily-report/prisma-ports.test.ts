import assert from "node:assert/strict";
import { test } from "node:test";

import { toPaidOrderRow } from "./prisma-sales-port";

test("totalCents se lee como pesos enteros, no como centavos", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 25_000,
    origin: "STANDARD_CHECKOUT",
    album: {
      id: 10,
      title: "Torneo Apertura",
      user: { id: 7, name: "Ana Pérez", email: "ana@example.com" },
    },
    items: [{ quantity: 2 }, { quantity: 1 }],
  });

  assert.equal(row.totalArs, 25_000);
});

test("suma las cantidades de los ítems como fotos vendidas", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 1_000,
    origin: "STANDARD_CHECKOUT",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: "Ana Pérez", email: "ana@example.com" },
    },
    items: [{ quantity: 2 }, { quantity: 3 }],
  });

  assert.equal(row.itemCount, 5);
});

test("cuando el fotógrafo no tiene nombre se usa el correo", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 1_000,
    origin: "STANDARD_CHECKOUT",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: null, email: "sinnombre@example.com" },
    },
    items: [],
  });

  assert.equal(row.photographerName, "sinnombre@example.com");
});

test("el origen de canje se traduce al valor del contrato", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 0,
    origin: "PACK_REDEMPTION",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: "Ana", email: "ana@example.com" },
    },
    items: [],
  });

  assert.equal(row.origin, "PACK_REDEMPTION");
});

test("el origen de preventa se conserva y no se confunde con checkout", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 0,
    origin: "PREVENTA_PACK",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: "Ana", email: "ana@example.com" },
    },
    items: [],
  });

  assert.equal(row.origin, "PREVENTA_PACK");
});

test("un origen desconocido se normaliza a checkout estándar", () => {
  const row = toPaidOrderRow({
    id: 1,
    totalCents: 0,
    origin: "ALGO_NUEVO",
    album: {
      id: 10,
      title: "Torneo",
      user: { id: 7, name: "Ana", email: "ana@example.com" },
    },
    items: [],
  });

  assert.equal(row.origin, "STANDARD_CHECKOUT");
});
