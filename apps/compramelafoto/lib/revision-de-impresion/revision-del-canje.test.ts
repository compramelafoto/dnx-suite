import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClassListGroups, serializeClassListGroups } from "@repo/template-engine";
import {
  aplicarCorrecciones,
  contenidoCanonico,
  FRASE_DE_AUTORIZACION,
  parseRevisionDelCliente,
  tituloDeLaRevision,
} from "./autorizacion";
import { aplicarRevisionDelCanje, textosAImprimir } from "./revision-del-canje";

const B = {
  key: "padron|||7.°|B",
  title: "7.° B",
  students: [
    { firstName: "Lía", lastName: "Ruiz" },
    { firstName: "Tomás", lastName: "Paz" },
  ],
};
const values = {
  "student.fullName": "Mria Gómez",
  "course.displayName": "7.° A",
  "school.name": "Colegio San Patricio",
  "course.studentList": serializeClassListGroups([
    { title: "7.° A", courseKey: "padron|||7.°|A", students: [{ firstName: "Mria", lastName: "Gómez", isOwner: true }] },
  ]),
};
const base = {
  values,
  textVariables: ["student.fullName", "course.displayName", "school.name", "course.studentList"],
  disponibles: [B],
  subject: "Carpeta San Patricio",
  by: { name: "Ana", email: "ana@example.com" },
  userAgent: "test",
  now: new Date("2026-10-22T15:00:00.000Z"),
};

test("la familia corrige su nombre pero no el colegio, el curso ni el listado", () => {
  const r = aplicarRevisionDelCanje({
    ...base,
    permiteSumar: false,
    revision: {
      autorizado: true,
      textos: { "student.fullName": "  María   Gómez ", "school.name": "Otro", "course.studentList": "[]" },
    },
  });
  assert.equal(r.values["student.fullName"], "María Gómez");
  assert.equal(r.values["school.name"], "Colegio San Patricio");
  assert.equal(r.values["course.studentList"], values["course.studentList"]);
  const a = r.clientReview.authorization!;
  assert.equal(a.statement, FRASE_DE_AUTORIZACION);
  assert.equal(a.authorizedAt, "2026-10-22T15:00:00.000Z");
  assert.deepEqual(a.edits, [{ key: "student.fullName", from: "Mria Gómez", to: "María Gómez" }]);
  // Lo que vio: los textos ya corregidos y el listado con su título.
  assert.equal(a.texts.find((t) => t.key === "student.fullName")?.value, "María Gómez");
  assert.equal(a.texts.some((t) => t.key === "course.studentList"), false);
  assert.deepEqual(a.lists, [{ title: "7.° A", names: ["Mria Gómez"] }]);
});

test("los cursos se suman sólo si la plantilla lo permite y si son del álbum", () => {
  const sin = aplicarRevisionDelCanje({ ...base, permiteSumar: false, revision: { autorizado: true, cursos: [B.key] } });
  assert.equal(parseClassListGroups(sin.values["course.studentList"]).length, 1);
  assert.deepEqual(sin.clientReview.extraCourseKeys, []);
  const con = aplicarRevisionDelCanje({
    ...base,
    permiteSumar: true,
    revision: { autorizado: true, cursos: [B.key, "inventado", B.key] },
  });
  assert.deepEqual(
    parseClassListGroups(con.values["course.studentList"]).map((g) => g.title),
    ["7.° A", "7.° B"],
  );
  assert.deepEqual(con.clientReview.extraCourseKeys, [B.key]);
  assert.equal(con.clientReview.authorization!.lists.length, 2);
});

test("los avisos de error llegan limpios y se leen de vuelta del JSON guardado", () => {
  const r = aplicarRevisionDelCanje({
    ...base,
    permiteSumar: false,
    revision: { autorizado: true, avisos: ["  Falta Juan Pérez  ", "", "   "] },
  });
  assert.deepEqual(r.clientReview.reports, [{ at: "2026-10-22T15:00:00.000Z", scope: "listado", text: "Falta Juan Pérez" }]);
  const leido = parseRevisionDelCliente(JSON.parse(JSON.stringify(r.clientReview)));
  assert.deepEqual(leido, r.clientReview);
  assert.equal(parseRevisionDelCliente(null), null);
});

test("textos a imprimir: el nombre del alumno es editable, el colegio no", () => {
  const t = textosAImprimir(base.textVariables, values);
  assert.deepEqual(
    t.map((x) => [x.key, x.editable]),
    [
      ["student.fullName", true],
      ["course.displayName", false],
      ["school.name", false],
    ],
  );
});

test("correcciones: sólo claves editables, sin vacíos ni cambios iguales", () => {
  const r = aplicarCorrecciones({ a: "1", b: "2" }, new Set(["a"]), { a: "1", b: "x" });
  assert.deepEqual(r.edits, []);
  assert.deepEqual(aplicarCorrecciones({ a: "1" }, new Set(["a"]), { a: "   " }).values, { a: "1" });
});

test("contenido canónico: el orden de las claves no cambia la huella", () => {
  assert.equal(contenidoCanonico({ b: 1, a: [{ y: 2, x: 1 }] }), contenidoCanonico({ a: [{ x: 1, y: 2 }], b: 1 }));
});

test("el título de la revisión usa el nombre del producto", () => {
  assert.equal(tituloDeLaRevision("Carpeta San Patricio"), "Revisá tu carpeta San Patricio");
  assert.equal(tituloDeLaRevision("Librito"), "Revisá tu librito");
  assert.equal(tituloDeLaRevision("SFPR anuario"), "Revisá tu SFPR anuario");
  assert.equal(tituloDeLaRevision(""), "Revisá todo antes de confirmar");
});
