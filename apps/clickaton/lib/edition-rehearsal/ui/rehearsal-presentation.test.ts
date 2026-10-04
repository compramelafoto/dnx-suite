import assert from "node:assert/strict";
import test from "node:test";

import type { Hallazgo, ResultadoPaso, Rubro, Severidad } from "../domain/types";
import {
  agruparPorRubro,
  enlaceDeHallazgo,
  presentarEstadoDePaso,
  presentarRubro,
  presentarSeveridad,
  resumirHallazgos,
  RUBROS_EN_ORDEN,
} from "./rehearsal-presentation";

function hallazgo(over: Partial<Hallazgo> = {}): Hallazgo {
  return {
    id: "x",
    rubro: "VENTA",
    severidad: "BIEN",
    titulo: "Título",
    detalle: "Detalle",
    comoArreglar: null,
    enlace: null,
    ...over,
  };
}

test("cada severidad tiene etiqueta en castellano", () => {
  assert.equal(presentarSeveridad("BIEN").etiqueta, "Todo bien");
  assert.equal(presentarSeveridad("ATENCION").etiqueta, "Atención");
  assert.equal(presentarSeveridad("BLOQUEANTE").etiqueta, "Bloqueante");
});

test("cada severidad tiene una variante de color distinta", () => {
  const variantes = (["BIEN", "ATENCION", "BLOQUEANTE"] as Severidad[]).map(
    (s) => presentarSeveridad(s).variante,
  );
  assert.equal(new Set(variantes).size, 3);
});

test("todos los rubros tienen nombre en castellano", () => {
  for (const rubro of RUBROS_EN_ORDEN) {
    const nombre = presentarRubro(rubro);
    assert.ok(nombre.trim().length > 0, `el rubro ${rubro} no tiene nombre`);
    assert.notEqual(nombre, rubro, `el rubro ${rubro} quedó sin traducir`);
  }
});

test("el veredicto avisa cuando hay bloqueantes", () => {
  const resumen = resumirHallazgos([hallazgo({ severidad: "BLOQUEANTE" })]);
  assert.equal(resumen.bloqueantes, 1);
  assert.match(resumen.veredicto, /no está lista/i);
});

test("con sólo atenciones el veredicto es intermedio", () => {
  const resumen = resumirHallazgos([hallazgo({ severidad: "ATENCION" })]);
  assert.equal(resumen.bloqueantes, 0);
  assert.equal(resumen.atenciones, 1);
  assert.match(resumen.veredicto, /revisar|mirar/i);
});

test("sin hallazgos graves el veredicto es positivo", () => {
  const resumen = resumirHallazgos([hallazgo({ severidad: "BIEN" })]);
  assert.equal(resumen.bloqueantes, 0);
  assert.equal(resumen.atenciones, 0);
  assert.equal(resumen.bien, 1);
  assert.match(resumen.veredicto, /lista/i);
});

test("el resumen cuenta bien una mezcla", () => {
  const resumen = resumirHallazgos([
    hallazgo({ id: "a", severidad: "BIEN" }),
    hallazgo({ id: "b", severidad: "BIEN" }),
    hallazgo({ id: "c", severidad: "ATENCION" }),
    hallazgo({ id: "d", severidad: "BLOQUEANTE" }),
  ]);
  assert.deepEqual(
    { bien: resumen.bien, atenciones: resumen.atenciones, bloqueantes: resumen.bloqueantes },
    { bien: 2, atenciones: 1, bloqueantes: 1 },
  );
});

test("agrupar por rubro respeta el orden fijo y omite los rubros vacíos", () => {
  const grupos = agruparPorRubro([
    hallazgo({ id: "a", rubro: "CONSIGNAS" }),
    hallazgo({ id: "b", rubro: "PUBLICACION" }),
    hallazgo({ id: "c", rubro: "CONSIGNAS" }),
  ]);
  assert.deepEqual(
    grupos.map((g) => g.rubro),
    ["PUBLICACION", "CONSIGNAS"] as Rubro[],
  );
  assert.equal(grupos[1]?.hallazgos.length, 2);
});

test("dentro de un rubro, lo bloqueante va primero", () => {
  const grupos = agruparPorRubro([
    hallazgo({ id: "a", rubro: "VENTA", severidad: "BIEN" }),
    hallazgo({ id: "b", rubro: "VENTA", severidad: "BLOQUEANTE" }),
    hallazgo({ id: "c", rubro: "VENTA", severidad: "ATENCION" }),
  ]);
  assert.deepEqual(
    grupos[0]?.hallazgos.map((h) => h.severidad),
    ["BLOQUEANTE", "ATENCION", "BIEN"],
  );
});

test("el enlace del hallazgo se arma sobre la edición", () => {
  assert.equal(
    enlaceDeHallazgo(hallazgo({ enlace: "precios" }), "ed1"),
    "/admin/ediciones/ed1/precios",
  );
});

test("un hallazgo sin enlace no inventa uno", () => {
  assert.equal(enlaceDeHallazgo(hallazgo({ enlace: null }), "ed1"), null);
});

test("cada estado de paso tiene etiqueta en castellano", () => {
  const estados: ResultadoPaso["estado"][] = ["PASO", "FALLO", "NO_CORRESPONDE"];
  const etiquetas = estados.map((e) => presentarEstadoDePaso(e).etiqueta);
  for (const etiqueta of etiquetas) {
    assert.ok(etiqueta.trim().length > 0);
  }
  assert.equal(new Set(etiquetas).size, 3);
});
