import { test } from "node:test";
import assert from "node:assert/strict";
import { leerAccionDelColegio, resumenParaElColegio } from "./resumen-para-el-colegio";

const entrada = {
  courseKey: "padron|Primario|Mañana|3|A",
  titulo: "3° A · Turno mañana · Primario",
  cerradoEl: null,
  enlaceVence: "2026-11-08T00:00:00.000Z",
  alumnos: [
    {
      rosterEntryId: 1,
      nombre: "Ana",
      apellido: "Pérez",
      retrato: { photoId: 10, url: "https://r2.example/uploads/x.jpg", fuente: "FAMILY", revisar: false },
      email: "familia@example.com",
    },
    { rosterEntryId: 2, nombre: "Beto", apellido: "Gómez", retrato: null },
  ],
  integrantes: [{ role: "Maestra", name: "Laura", photoId: 20, url: "https://r2.example/uploads/y.jpg" }],
  sinIdentificar: [{ photoId: 30, url: "https://r2.example/uploads/z.jpg" }],
};

test("arma el resumen reducido para el colegio", () => {
  assert.deepEqual(resumenParaElColegio(entrada), {
    titulo: "3° A · Turno mañana · Primario",
    alumnos: [
      { rosterEntryId: 1, nombre: "Ana", apellido: "Pérez", tieneRetrato: true },
      { rosterEntryId: 2, nombre: "Beto", apellido: "Gómez", tieneRetrato: false },
    ],
    sinIdentificar: [{ photoId: 30 }],
    integrantes: [{ role: "Maestra", name: "Laura", tieneFoto: true, photoId: 20 }],
  });
});

test("no deja pasar URLs, datos de compra ni de familias", () => {
  const json = JSON.stringify(resumenParaElColegio(entrada));
  assert.ok(!json.includes("http"));
  assert.ok(!json.includes("r2."));
  assert.ok(!json.includes("familia@"));
  assert.ok(!json.includes("FAMILY"));
  assert.ok(!json.includes("courseKey"));
  assert.ok(!json.includes("enlaceVence"));
});

test("integrante sin foto", () => {
  const r = resumenParaElColegio({ ...entrada, integrantes: [{ role: "Directora", name: "", photoId: null }] });
  assert.deepEqual(r.integrantes, [{ role: "Directora", name: "", tieneFoto: false, photoId: null }]);
});

test("acciones válidas del POST", () => {
  assert.deepEqual(leerAccionDelColegio({ accion: "asignar", photoId: 30, rosterEntryId: 2 }), {
    accion: "asignar",
    photoId: 30,
    rosterEntryId: 2,
  });
  assert.deepEqual(leerAccionDelColegio({ accion: "integrantes", integrantes: [{ role: " Seño ", name: "Laura", photoId: 99 }] }), {
    accion: "integrantes",
    integrantes: [{ role: "Seño", name: "Laura" }],
  });
});

test("cualquier otra cosa no hace nada", () => {
  for (const body of [
    null,
    [],
    "asignar",
    {},
    { accion: "cerrar" },
    { accion: "asignar", photoId: "30", rosterEntryId: 2 },
    { accion: "asignar", photoId: 1.5, rosterEntryId: 2 },
    { accion: "asignar", photoId: -1, rosterEntryId: 2 },
    { accion: "integrantes", integrantes: "x" },
    { accion: "integrantes", integrantes: new Array(21).fill({ role: "a", name: "b" }) },
  ]) {
    assert.equal(leerAccionDelColegio(body), null, JSON.stringify(body));
  }
});
