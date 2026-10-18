import assert from "node:assert/strict";
import test from "node:test";

import { createFxLookup } from "./fx";

const SERIE = [
  { casa: "tarjeta", venta: 1980, fecha: "2026-08-28" },
  { casa: "tarjeta", venta: 1989, fecha: "2026-08-31" },
];

function fakeFetch(opts: { serie?: unknown; hoy?: number; fail?: boolean } = {}) {
  const calls: string[] = [];
  const impl = (async (url: string | URL) => {
    const u = String(url);
    calls.push(u);
    if (opts.fail) throw new Error("caída");
    if (u.includes("dolarapi.com")) {
      return opts.hoy ? new Response(JSON.stringify({ venta: opts.hoy }), { status: 200 }) : new Response("", { status: 500 });
    }
    return new Response(JSON.stringify(opts.serie ?? SERIE), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const D = (s: string) => new Date(`${s}T12:00:00Z`);

test("devuelve el dólar tarjeta de venta de ese día", async () => {
  const fx = createFxLookup({ fetchImpl: fakeFetch().impl, today: D("2026-10-18") });
  assert.equal(await fx(D("2026-08-31")), 1989);
});

test("si ese día no tiene cotización, usa el día anterior más cercano", async () => {
  const fx = createFxLookup({ fetchImpl: fakeFetch().impl, today: D("2026-10-18") });
  assert.equal(await fx(D("2026-08-30")), 1980);
});

test("I4: baja la serie una sola vez por corrida, no una consulta por fecha", async () => {
  const f = fakeFetch();
  const fx = createFxLookup({ fetchImpl: f.impl, today: D("2026-10-18") });
  await fx(D("2026-08-31"));
  await fx(D("2026-08-30"));
  await fx(D("2026-08-28"));
  assert.equal(f.calls.length, 1);
});

test("para fechas posteriores a la serie usa la cotización del día", async () => {
  const fx = createFxLookup({ fetchImpl: fakeFetch({ hoy: 2050 }).impl, today: D("2026-10-18") });
  assert.equal(await fx(D("2026-10-18")), 2050);
});

test("una fecha muy anterior al último dato de la serie no inventa cotización", async () => {
  const fx = createFxLookup({ fetchImpl: fakeFetch().impl, today: D("2026-10-18") });
  assert.equal(await fx(D("2026-01-10")), null);
});

test("sin cotización en ningún lado devuelve null (el mail se reintenta después)", async () => {
  const fx = createFxLookup({ fetchImpl: fakeFetch({ fail: true }).impl, today: D("2026-10-18") });
  assert.equal(await fx(D("2026-08-31")), null);
});
