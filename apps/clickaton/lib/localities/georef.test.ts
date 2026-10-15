import assert from "node:assert/strict";
import test from "node:test";

import { ubicarLocalidad } from "./georef";

function georefFalso(respuestas: Record<string, { nombre: string; provincia: string }[]>) {
  const pedidos: string[] = [];
  const fetchImpl = (async (url: URL) => {
    const clave = `${url.searchParams.get("nombre")}|${url.searchParams.get("provincia") ?? ""}`;
    pedidos.push(clave);
    const localidades = (respuestas[clave] ?? []).map((l) => ({
      nombre: l.nombre,
      provincia: { nombre: l.provincia },
      departamento: { nombre: null },
      centroide: { lat: -33, lon: -60 },
    }));
    return new Response(JSON.stringify({ localidades }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, pedidos };
}

test("una sola localidad con ese nombre en la provincia queda resuelta", async () => {
  const { fetchImpl } = georefFalso({ "Rosario|Santa Fe": [{ nombre: "Rosario", provincia: "Santa Fe" }] });
  const r = await ubicarLocalidad({ ciudad: "Rosario", provincia: "Santa Fe" }, fetchImpl);
  assert.equal(r.estado, "RESUELTA");
});

test("sin tilde también es exacta: Perez es Pérez, no Gregoria Pérez de Denis", async () => {
  const { fetchImpl } = georefFalso({
    "Perez|Santa Fe": [
      { nombre: "Pérez", provincia: "Santa Fe" },
      { nombre: "Gregoria Pérez de Denis", provincia: "Santa Fe" },
    ],
  });
  const r = await ubicarLocalidad({ ciudad: "Perez", provincia: "Santa Fe" }, fetchImpl);
  assert.equal(r.estado, "RESUELTA");
  assert.equal(r.estado === "RESUELTA" && r.elegida.ciudad, "Pérez");
});

test("con provincia ilegible busca sin ella, y si hay varias queda dudosa", async () => {
  const { fetchImpl, pedidos } = georefFalso({
    "ROsario|": [
      { nombre: "Rosario", provincia: "Santa Fe" },
      { nombre: "Rosario", provincia: "Corrientes" },
    ],
  });
  const r = await ubicarLocalidad({ ciudad: "ROsario", provincia: "S" }, fetchImpl);
  assert.deepEqual(pedidos, ["ROsario|S", "ROsario|"]);
  assert.equal(r.estado, "DUDOSA");
  assert.equal(r.candidatas.length, 2);
});

test("fuera de Argentina no se busca", async () => {
  const { fetchImpl, pedidos } = georefFalso({});
  const r = await ubicarLocalidad({ ciudad: "Montevideo", provincia: null, pais: "UY" }, fetchImpl);
  assert.equal(r.estado, "NO_ENCONTRADA");
  assert.equal(pedidos.length, 0);
});
