import { test } from "node:test";
import assert from "node:assert/strict";
import { alumnoDesdeRefs, cursoCorto, rotuloDeAlumno } from "./alumno-del-pedido";
import { acabadoParaExportar, productosDelAlbum } from "./export-product-name";
import { carpetaDePedido } from "./rutas-cortas";

test("pack externo: alumno y curso, no el adulto", () => {
  const a = alumnoDesdeRefs({
    kind: "EXTERNAL_PREVENTA_PACK",
    parentName: "Gnagnarello Griselda",
    studentName: "Lozano Esmeralda",
    courseName: "7° Grado B",
  });
  assert.deepEqual(a, { alumno: "Lozano Esmeralda", curso: "7° Grado B" });
  assert.equal(rotuloDeAlumno(a!), "7B Lozano Esmeralda");
  assert.equal(carpetaDePedido("5064", rotuloDeAlumno(a!), 32), "5064 7B Lozano Esmeralda");
});

test("otros refs no son alumno", () => {
  assert.equal(alumnoDesdeRefs({ kind: "MP" }), null);
  assert.equal(alumnoDesdeRefs(null), null);
  assert.equal(alumnoDesdeRefs({ kind: "EXTERNAL_PREVENTA_PACK", studentName: " " }), null);
});

test("curso corto", () => {
  assert.equal(cursoCorto("7° Grado A"), "7A");
  assert.equal(cursoCorto("Sala 3A"), "Sala 3A");
});

const filas = [
  { name: "Copia individual", size: "15x21 cm", acabado: "Mate", albumId: null },
  { name: "Foto individual", size: "15x21 cm", acabado: "Mate", albumId: 1200 },
  { name: "Foto impresa", size: "15x21 cm", acabado: null, albumId: 1106 },
  { name: "Librito escolar", size: "Librito", acabado: null, albumId: 1106 },
];

test("álbum con productos propios: sólo los suyos", () => {
  assert.deepEqual(productosDelAlbum(filas, 1106).map((p) => p.name), ["Foto impresa", "Librito escolar"]);
  assert.deepEqual(productosDelAlbum(filas, 999).map((p) => p.name), ["Copia individual"]);
});

test("no inventa Brillo si el producto no tiene acabado", () => {
  const propios = productosDelAlbum(filas, 1106);
  assert.equal(acabadoParaExportar(propios, "15x21 cm", "BRILLO"), "");
  assert.equal(acabadoParaExportar(productosDelAlbum(filas, 999), "15x21 cm", "MATE"), "MATE");
  // Tamaño desconocido: se respeta lo grabado.
  assert.equal(acabadoParaExportar(propios, "10x15", "BRILLO"), "BRILLO");
});
