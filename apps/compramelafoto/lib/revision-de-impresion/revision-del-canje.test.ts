import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClassListGroups, serializeClassListGroups } from "@repo/template-engine";
import {
  anularAutorizacion,
  aplicarCorrecciones,
  contenidoCanonico,
  parseRevisionDelCliente,
  tituloDeLaRevision,
} from "./autorizacion";
import { aplicarRevisionDelCanje, FRASE_DE_AUTORIZACION_LIBRITO, textosAImprimir } from "./revision-del-canje";

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
  assert.equal(a.statement, FRASE_DE_AUTORIZACION_LIBRITO);
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

test("anular la autorización la deja guardada con fecha y motivo; sin autorización no cambia nada", () => {
  const r = aplicarRevisionDelCanje({ ...base, permiteSumar: false, revision: { autorizado: true } }).clientReview;
  const ahora = new Date("2026-10-23T10:00:00.000Z");
  const { revision, anulada } = anularAutorizacion(r, "Se pasó a la versión nueva de la plantilla.", ahora);
  assert.equal(anulada, true);
  assert.equal(revision!.authorization, null);
  assert.equal(revision!.revoked!.length, 1);
  assert.equal(revision!.revoked![0]!.authorizedAt, "2026-10-22T15:00:00.000Z");
  assert.equal(revision!.revoked![0]!.revokedAt, "2026-10-23T10:00:00.000Z");
  assert.equal(revision!.revoked![0]!.revokedReason, "Se pasó a la versión nueva de la plantilla.");
  // Se lee igual desde el JSON guardado, y anular otra vez no hace nada.
  const leida = parseRevisionDelCliente(JSON.parse(JSON.stringify(revision)));
  assert.deepEqual(leida, revision);
  assert.deepEqual(anularAutorizacion(leida, "otra", ahora), { revision: leida, anulada: false });
  assert.deepEqual(anularAutorizacion(null, "x", ahora), { revision: null, anulada: false });
});

test("el título de la revisión usa el nombre del producto", () => {
  assert.equal(tituloDeLaRevision("Carpeta San Patricio"), "Revisá tu carpeta San Patricio");
  assert.equal(tituloDeLaRevision("Librito"), "Revisá tu librito");
  assert.equal(tituloDeLaRevision("SFPR anuario"), "Revisá tu SFPR anuario");
  assert.equal(tituloDeLaRevision(""), "Revisá todo antes de confirmar");
});

test("la familia corrige un nombre del listado: va en su librito y le avisa al fotógrafo", () => {
  const r = aplicarRevisionDelCanje({
    ...base,
    permiteSumar: true,
    revision: {
      autorizado: true,
      cursos: ["padron|||7.°|B"],
      nombres: [
        { de: { firstName: "Lía", lastName: "Ruiz" }, a: { firstName: "Lía", lastName: "Ruiz Díaz" } },
        { de: { firstName: "Nadie", lastName: "Acá" }, a: { firstName: "Otro", lastName: "Nombre" } },
      ],
      avisos: ["Falta Juan Pérez"],
    },
  });
  const grupos = parseClassListGroups(r.values["course.studentList"]);
  assert.ok(grupos[1]!.students.some((s) => s.lastName === "Ruiz Díaz"));
  const a = r.clientReview.authorization!;
  assert.deepEqual(a.edits, [{ key: "nombre del listado", from: "Lía Ruiz", to: "Lía Ruiz Díaz" }]);
  const avisos = r.clientReview.reports.map((x) => x.text);
  assert.equal(avisos.length, 2);
  assert.match(avisos[0]!, /«Lía Ruiz» → «Lía Ruiz Díaz»/);
  assert.doesNotMatch(avisos[0]!, /Nadie/);
  assert.equal(avisos[1], "Falta Juan Pérez");
});

test("la familia escribe nombre y apellido por separado: se arman la tapa y el listado", () => {
  const conCampos = {
    ...values,
    "student.firstName": "Saroli Delfina",
    "student.lastName": "Carranza",
    "student.fullName": "Carranza Saroli Delfina",
    "course.studentList": serializeClassListGroups([
      {
        title: "7.° A",
        courseKey: "padron|||7.°|A",
        students: [{ firstName: "Saroli Delfina", lastName: "Carranza", isOwner: true }],
      },
    ]),
  };
  const r = aplicarRevisionDelCanje({
    ...base,
    values: conCampos,
    textVariables: ["student.firstName", "course.studentList"],
    permiteSumar: false,
    revision: { autorizado: true, textos: { "student.firstName": " Delfina ", "student.lastName": "Carranza  Saroli" } },
  });
  assert.equal(r.values["student.firstName"], "Delfina");
  assert.equal(r.values["student.lastName"], "Carranza Saroli");
  assert.equal(r.values["student.fullName"], "Delfina Carranza Saroli");
  assert.equal(r.values["student.lastNameFirst"], "Carranza Saroli, Delfina");
  const alumno = parseClassListGroups(r.values["course.studentList"])[0]!.students[0]!;
  assert.deepEqual([alumno.firstName, alumno.lastName, alumno.isOwner], ["Delfina", "Carranza Saroli", true]);
  assert.deepEqual(r.clientReview.authorization!.edits, [
    { key: "student.firstName", from: "Saroli Delfina", to: "Delfina" },
    { key: "student.lastName", from: "Carranza", to: "Carranza Saroli" },
  ]);
});
