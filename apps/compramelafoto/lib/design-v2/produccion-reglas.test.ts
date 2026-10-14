import assert from "node:assert/strict";
import { test } from "node:test";
import {
  datosDelLibrito,
  nombreDeArchivo,
  nombreDelProximoLote,
  ordenDeImpresion,
} from "./produccion-reglas";

const l = (id: number, alumno: string, curso: string, colegio = "Colegio San Patricio") => ({ id, alumno, curso, colegio });

test("ordena por colegio, curso y alumno, con números de curso naturales", () => {
  const orden = ordenDeImpresion([
    l(1, "Savini Felipe", "5.º B"),
    l(2, "Alsina Justo", "5.º A"),
    l(3, "Arce Olivia", "5.º A"),
    l(4, "Zeta Ana", "10.º A"),
    l(5, "Ábalos Ema", "5.º A"),
  ]);
  assert.deepEqual(orden.map((x) => x.id), [5, 2, 3, 1, 4]);
});

test("el nombre de archivo lleva número, curso y alumno, sin caracteres prohibidos", () => {
  assert.equal(nombreDeArchivo(1, l(77, "Alsina Justo", "5.º A"), 41), "001 - 5.º A - Alsina Justo (diseño 77).pdf");
  assert.equal(nombreDeArchivo(12, l(8, 'Pérez/Gómez: "Ana"', "6º B"), 1200), "0012 - 6º B - Pérez Gómez Ana (diseño 8).pdf");
});

test("el próximo lote sigue la numeración", () => {
  const fecha = new Date("2026-10-14T15:00:00Z");
  assert.equal(nombreDelProximoLote([], fecha), "Lote 1 · 14/10");
  assert.equal(nombreDelProximoLote(["Lote 2 · 10/10", "Lote 9 · 12/10", "Otro"], fecha), "Lote 10 · 14/10");
});

test("los datos del librito salen de los valores del diseño", () => {
  assert.deepEqual(
    datosDelLibrito(5, { "student.lastNameFirst": "Alsina, Justo", "course.displayName": "5.º A", "school.name": "Colegio San Patricio" }),
    { id: 5, alumno: "Alsina Justo", curso: "5.º A", colegio: "Colegio San Patricio" },
  );
  assert.deepEqual(datosDelLibrito(6, null), { id: 6, alumno: "", curso: "", colegio: "" });
});
