import assert from "node:assert/strict";
import test from "node:test";

import { createFxLookup } from "./fx";

function fakeFetch(table: Record<string, number | "error">) {
  const calls: string[] = [];
  const impl = (async (url: string | URL) => {
    const u = String(url);
    calls.push(u);
    const key = Object.keys(table).find((k) => u.endsWith(k));
    const v = key ? table[key] : undefined;
    if (v === undefined) return new Response("not found", { status: 404 });
    if (v === "error") throw new Error("caída");
    return new Response(JSON.stringify({ casa: "tarjeta", venta: v }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const D = (s: string) => new Date(`${s}T12:00:00Z`);

test("devuelve el dólar tarjeta de venta de ese día", async () => {
  const f = fakeFetch({ "/2026/08/31": 1989 });
  const fx = createFxLookup({ fetchImpl: f.impl, today: D("2026-10-18") });
  assert.equal(await fx(D("2026-08-31")), 1989);
});

test("si ese día no tiene cotización, usa el día hábil anterior más cercano", async () => {
  const f = fakeFetch({ "/2026/08/28": 1980 });
  const fx = createFxLookup({ fetchImpl: f.impl, today: D("2026-10-18") });
  assert.equal(await fx(D("2026-08-30")), 1980);
});

test("pide cada fecha una sola vez por corrida", async () => {
  const f = fakeFetch({ "/2026/08/31": 1989 });
  const fx = createFxLookup({ fetchImpl: f.impl, today: D("2026-10-18") });
  await fx(D("2026-08-31"));
  await fx(D("2026-08-31"));
  assert.equal(f.calls.length, 1);
});

test("para hoy, si el histórico todavía no lo tiene, usa la cotización del día", async () => {
  const f = fakeFetch({ "dolarapi.com/v1/dolares/tarjeta": 2050 });
  const fx = createFxLookup({ fetchImpl: f.impl, today: D("2026-10-18") });
  assert.equal(await fx(D("2026-10-18")), 2050);
});

test("sin cotización en ningún lado devuelve null (el mail se reintenta después)", async () => {
  const f = fakeFetch({ "/2026/08/31": "error" });
  const fx = createFxLookup({ fetchImpl: f.impl, today: D("2026-10-18") });
  assert.equal(await fx(D("2026-08-31")), null);
});
