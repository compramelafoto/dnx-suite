import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { serializeClassListGroups } from "@repo/template-engine";
import { corregirNombresEnValores, normalizarCambiosDeNombre } from "./corregir-nombres";

const listado = serializeClassListGroups([
  {
    title: "7° Grado A",
    courseKey: "padron|7A",
    students: [
      { firstName: "Saroli Delfina", lastName: "Carranza", isOwner: true },
      { firstName: "Camila", lastName: "Bilesio" },
    ],
  },
]);

const valores = {
  "course.studentList": listado,
  "course.mosaic": JSON.stringify([{ firstName: "Camila", lastName: "Bilesio", photoId: 7 }]),
  "course.mosaicOwner": JSON.stringify({ firstName: "Saroli Delfina", lastName: "Carranza", photoId: 9 }),
  "student.firstName": "Saroli Delfina",
  "student.lastName": "Carranza",
  "student.fullName": "Carranza Saroli Delfina",
  "course.displayName": "7° Grado A",
};

describe("normalizarCambiosDeNombre", () => {
  it("descarta los vacíos, los que no cambian nada y los repetidos", () => {
    const c = normalizarCambiosDeNombre([
      { de: { firstName: "Camila", lastName: "Bilesio" }, a: { firstName: "Camila", lastName: "Bilesio" } },
      { de: { firstName: "Camila", lastName: "Bilesio" }, a: { firstName: "Camila", lastName: "" } },
      { de: { firstName: " Camila ", lastName: "Bilesio" }, a: { firstName: "Camila  Sol", lastName: "Bilesio" } },
      { de: { firstName: "camila", lastName: "BILESIO" }, a: { firstName: "Otra", lastName: "Cosa" } },
      "basura",
    ]);
    assert.deepEqual(c, [{ de: { firstName: "Camila", lastName: "Bilesio" }, a: { firstName: "Camila Sol", lastName: "Bilesio" } }]);
  });
});

describe("corregirNombresEnValores", () => {
  const cambio = normalizarCambiosDeNombre([
    { de: { firstName: "Saroli Delfina", lastName: "Carranza" }, a: { firstName: "Delfina", lastName: "Carranza Saroli" } },
  ]);

  it("corrige el listado, el mosaico y la tapa del alumno, y conserva el resto", () => {
    const { values, cambiados } = corregirNombresEnValores(valores, cambio);
    assert.match(values["course.studentList"]!, /"f":"Delfina","l":"Carranza Saroli","o":1/);
    assert.match(values["course.studentList"]!, /"k":"padron\|7A"/);
    assert.match(values["course.mosaicOwner"]!, /"firstName":"Delfina","lastName":"Carranza Saroli","photoId":9/);
    assert.equal(values["course.mosaic"], valores["course.mosaic"]);
    assert.equal(values["student.firstName"], "Delfina");
    assert.equal(values["student.fullName"], "Delfina Carranza Saroli");
    assert.equal(values["student.lastNameFirst"], "Carranza Saroli, Delfina");
    assert.ok(cambiados.includes("course.studentList"));
    assert.ok(!cambiados.includes("course.mosaic"));
  });

  it("en un librito de otro alumno sólo cambia el compañero, no la tapa", () => {
    const otro = { ...valores, "student.firstName": "Camila", "student.lastName": "Bilesio", "student.fullName": "Camila Bilesio" };
    const { values } = corregirNombresEnValores(otro, cambio);
    assert.equal(values["student.firstName"], "Camila");
    assert.match(values["course.studentList"]!, /Carranza Saroli/);
  });

  it("si el nombre no está en el librito, no cambia nada", () => {
    const nadie = normalizarCambiosDeNombre([
      { de: { firstName: "Juan", lastName: "Pérez" }, a: { firstName: "Juan", lastName: "Peres" } },
    ]);
    const { values, cambiados } = corregirNombresEnValores(valores, nadie);
    assert.deepEqual(cambiados, []);
    assert.deepEqual(values, valores);
  });
});
