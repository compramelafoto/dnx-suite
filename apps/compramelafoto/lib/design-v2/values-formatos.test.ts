import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDesignValues } from "./values";

test("nombre y apellido por separado dan todos los formatos del alumno", () => {
  const v = buildDesignValues({ studentFirstName: "Inés", studentLastName: "Araujo" });
  assert.equal(v["student.fullName"], "Inés Araujo");
  assert.equal(v["student.lastNameFirst"], "Araujo, Inés");
  assert.equal(v["student.firstName"], "Inés");
  assert.equal(v["student.lastName"], "Araujo");
});

test("curso y colegio en un mismo texto, en los dos órdenes", () => {
  const v = buildDesignValues({ courseName: "Sala 3A", schoolName: "Colegio San Patricio" });
  assert.equal(v["course.withSchool"], "Sala 3A - Colegio San Patricio");
  assert.equal(v["school.withCourse"], "Colegio San Patricio - Sala 3A");
});

test("si falta uno, va el que hay, sin guion suelto", () => {
  const v = buildDesignValues({ courseName: "Sala 3A" });
  assert.equal(v["course.withSchool"], "Sala 3A");
  assert.equal(v["school.withCourse"], "Sala 3A");
});

test("sólo el nombre completo: los formatos partidos usan su respaldo", () => {
  const v = buildDesignValues({ studentName: "Araujo Ines" });
  assert.equal(v["student.fullName"], "Araujo Ines");
  assert.equal(v["student.firstName"], undefined);
  assert.equal(v["student.lastNameFirst"], undefined);
});
