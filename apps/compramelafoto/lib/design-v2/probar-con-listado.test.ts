import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLASS_LIST_VARIABLE_KEY,
  COURSE_MOSAIC_VARIABLE_KEY,
  parseClassListGroups,
  parseCourseMosaic,
} from "@repo/template-engine";
import {
  cursosDelPadronDeLaEscuela,
  etiquetaDelAlumno,
  moverAlumno,
  reemplazarValoresDelListado,
  valoresDeEjemplo,
  valoresDelAlumno,
  type FilaDelPadron,
} from "./probar-con-listado";

const fila = (firstName: string, lastName: string, extra: Partial<FilaDelPadron> = {}): FilaDelPadron => ({
  studentId: null,
  level: "Primario",
  shift: "Mañana",
  courseName: "7",
  division: "A",
  snapshotFirstName: firstName,
  snapshotLastName: lastName,
  ...extra,
});

test("agrupa el padrón de la escuela por curso, sin repetir alumnos de distintos álbumes, por apellido", () => {
  const cursos = cursosDelPadronDeLaEscuela([
    fila("Zoe", "Pérez", { studentId: 1 }),
    fila("Ana", "Gómez", { studentId: 2 }),
    // El mismo alumno en otro álbum de la escuela (por id y por nombre).
    fila("Zoé", "Perez", { studentId: 1 }),
    fila("ana", "gomez"),
    fila("Luis", "Díaz", { courseName: "6", division: "B", shift: "Tarde" }),
    fila("Sin", "Curso", { courseName: "  " }),
  ]);
  assert.deepEqual(
    cursos.map((c) => c.title),
    ["6° B", "7° A"],
  );
  assert.deepEqual(
    cursos[1]!.students.map((s) => `${s.firstName} ${s.lastName}`),
    ["Ana Gómez", "Zoe Pérez"],
  );
  assert.equal(cursos[0]!.shift, "Tarde");
});

test("dos cursos con el mismo nombre y turno llevan el nivel en el título", () => {
  const cursos = cursosDelPadronDeLaEscuela([fila("A", "Uno"), fila("B", "Dos", { level: "Secundario" })]);
  assert.deepEqual(cursos.map((c) => c.title).sort(), ["7° A Primario", "7° A Secundario"]);
});

test("los textos del alumno elegido: su nombre en todos los formatos, curso, escuela, listado y mosaico", () => {
  const [curso] = cursosDelPadronDeLaEscuela([fila("Ana", "Gómez"), fila("Bruno", "López"), fila("Carla", "Ruiz")]);
  const v = valoresDelAlumno({ curso: curso!, indice: 1, schoolName: "Escuela N.° 5" });
  assert.equal(v["student.fullName"], "Bruno López");
  assert.equal(v["student.firstName"], "Bruno");
  assert.equal(v["student.lastName"], "López");
  assert.equal(v["student.lastNameFirst"], "López, Bruno");
  assert.equal(v["course.displayName"], "7° A");
  assert.equal(v["school.name"], "Escuela N.° 5");
  assert.equal(v["course.withSchool"], "7° A - Escuela N.° 5");

  const [grupo] = parseClassListGroups(v[CLASS_LIST_VARIABLE_KEY]);
  assert.equal(grupo!.title, "7° A");
  assert.equal(grupo!.students.length, 3);
  assert.deepEqual(
    grupo!.students.filter((s) => s.isOwner).map((s) => s.firstName),
    ["Bruno"],
  );
  assert.deepEqual(
    parseCourseMosaic(v[COURSE_MOSAIC_VARIABLE_KEY]).map((s) => s.firstName),
    ["Ana", "Carla"],
  );
});

test("al cambiar de alumno se reemplazan los textos del listado y se conserva lo demás", () => {
  const [curso] = cursosDelPadronDeLaEscuela([fila("Ana", "Gómez")]);
  const antes = { ...valoresDeEjemplo(), "photographer.displayName": "Mi estudio" };
  const sinEscuela = valoresDelAlumno({ curso: curso!, indice: 0 });
  const out = reemplazarValoresDelListado(antes, sinEscuela);
  assert.equal(out["student.fullName"], "Ana Gómez");
  assert.equal(out["photographer.displayName"], "Mi estudio");
  // La escuela de ejemplo no queda pegada si la real no tiene nombre.
  assert.equal(out["school.name"], undefined);
  // Y volver al ejemplo deja los textos de siempre.
  assert.equal(reemplazarValoresDelListado(out, valoresDeEjemplo())["student.fullName"], "Nombre del Alumno");
});

test("pasa de un alumno al otro dando la vuelta, y la etiqueta cuenta desde 1", () => {
  assert.equal(moverAlumno(0, 20, 1), 1);
  assert.equal(moverAlumno(19, 20, 1), 0);
  assert.equal(moverAlumno(0, 20, -1), 19);
  assert.equal(moverAlumno(25, 20, 1), 0);
  assert.equal(moverAlumno(3, 0, 1), 0);
  assert.equal(etiquetaDelAlumno(2, 20), "Alumno 3 de 20");
  assert.equal(etiquetaDelAlumno(0, 0), "Sin alumnos");
});

test("un curso sin alumnos no llena nada", () => {
  assert.deepEqual(valoresDelAlumno({ curso: { key: "k", title: "7° A", students: [] }, indice: 0 }), {});
});
