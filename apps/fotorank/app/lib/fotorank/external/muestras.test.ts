/* eslint-disable turbo/no-undeclared-env-vars -- el test cambia la variable optativa MUESTRAS_PUBLIC_BASE_URL */
import test from "node:test";
import assert from "node:assert/strict";

import { armarMuestraUrl, muestrasBaseUrl, muestrasDelConcurso } from "./muestras";

function conBase<T>(valor: string | undefined, fn: () => T): T {
  const antes = process.env.MUESTRAS_PUBLIC_BASE_URL;
  if (valor === undefined) delete process.env.MUESTRAS_PUBLIC_BASE_URL;
  else process.env.MUESTRAS_PUBLIC_BASE_URL = valor;
  try {
    return fn();
  } finally {
    if (antes === undefined) delete process.env.MUESTRAS_PUBLIC_BASE_URL;
    else process.env.MUESTRAS_PUBLIC_BASE_URL = antes;
  }
}

test("armarMuestraUrl: por omisión, Muestras Fotográficas", () => {
  conBase(undefined, () => {
    assert.equal(muestrasBaseUrl(), "https://muestrasfotograficas.com");
    assert.equal(armarMuestraUrl("abc"), "https://muestrasfotograficas.com/panel/concursos/abc");
  });
});

test("armarMuestraUrl: con la variable, sin barra doble", () => {
  conBase("http://localhost:3014/", () => {
    assert.equal(armarMuestraUrl("abc"), "http://localhost:3014/panel/concursos/abc");
  });
});

test("muestrasDelConcurso: si la base tira error (migración sin aplicar), lista vacía", async () => {
  const errores: unknown[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => errores.push(a);
  try {
    const db = { culturalContestImport: { findMany: async () => { throw new Error('relation "CulturalContestImport" does not exist'); } } };
    assert.deepEqual(await muestrasDelConcurso("c1", db), []);
    assert.equal(errores.length, 1);
  } finally {
    console.error = original;
  }
});

test("muestrasDelConcurso: sólo publicadas, no canceladas y de tipo muestra; URL /m/<slug>", async () => {
  const pedidos: unknown[] = [];
  const startsAt = new Date("2026-11-09T03:00:00Z");
  const endsAt = new Date("2026-12-09T02:59:59Z");
  const db = {
    culturalContestImport: {
      findMany: async (args: unknown) => {
        pedidos.push(args);
        return [{ activity: { slug: "muestra-paisajes", title: "Muestra Paisajes", venueName: "Centro Cultural", city: "Rosario", startsAt, endsAt } }];
      },
    },
  };
  const r = await conBase(undefined, () => muestrasDelConcurso("c1", db));
  assert.deepEqual(r, [
    { title: "Muestra Paisajes", url: "https://muestrasfotograficas.com/m/muestra-paisajes", venue: "Centro Cultural", city: "Rosario", startsAt, endsAt },
  ]);
  const where = (pedidos[0] as { where: unknown }).where;
  assert.deepEqual(where, { contestId: "c1", activity: { reviewStatus: "APPROVED", isCancelled: false, type: "MUESTRA" } });
});
