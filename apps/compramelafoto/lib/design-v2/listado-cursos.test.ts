import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClassListGroups, serializeClassList, serializeClassListGroups } from "@repo/template-engine";
import {
  armarListadoConCursos,
  avisoDeMuchaGente,
  clavesDeCursosSumados,
  claveDelCursoPropio,
  cursoParaElegir,
  cursosParaSumar,
  fotoGrupalDelDiseno,
  listadoPermiteSumarCursos,
  valoresConCursos,
  type CursoDelAlbum,
} from "./listado-cursos";

const alumnos = (prefijo: string, n: number) =>
  Array.from({ length: n }, (_, i) => ({ firstName: `${prefijo}${i}`, lastName: "Apellido" }));

const A: CursoDelAlbum = { key: "padron|Primario|Mañana|7°|A", title: "7° A", students: alumnos("a", 20) };
const B: CursoDelAlbum = { key: "padron|Primario|Mañana|7°|B", title: "7° B", students: alumnos("b", 22) };
const C: CursoDelAlbum = { key: "padron|Primario|Tarde|6°|A", title: "6° A", students: alumnos("c", 18) };
const disponibles = [A, B, C];

const propio = { title: "7° A", courseKey: A.key, students: [...A.students.slice(1), { ...A.students[0]!, isOwner: true }] };

test("suma los cursos elegidos después del propio, que queda igual (con el alumno marcado)", () => {
  const out = armarListadoConCursos([propio], disponibles, [C.key, B.key]);
  assert.deepEqual(
    out.map((g) => g.title),
    ["7° A", "7° B", "6° A"],
  );
  assert.equal(out[0], propio);
  assert.equal(out[1]!.students.some((s) => s.isOwner), false);
});

test("no se puede sumar el curso propio ni uno que no es del álbum; sin elegir, queda sólo el propio", () => {
  assert.equal(armarListadoConCursos([propio], disponibles, [A.key, "inventado"]).length, 1);
  assert.deepEqual(armarListadoConCursos([propio, { ...B, courseKey: B.key }], disponibles, []), [propio]);
});

test("un listado viejo (sin clave) reconoce su curso por el título o por los alumnos", () => {
  const viejo = parseClassListGroups(serializeClassList(A.students), "7° A");
  assert.equal(claveDelCursoPropio(viejo, disponibles), A.key);
  const sinTitulo = parseClassListGroups(serializeClassList(B.students));
  assert.equal(claveDelCursoPropio(sinTitulo, disponibles), B.key);
  assert.deepEqual(
    cursosParaSumar(viejo, disponibles).map((c) => c.key),
    [B.key, C.key],
  );
  // Al sumar, el propio gana su clave.
  assert.equal(armarListadoConCursos(viejo, disponibles, [B.key])[0]!.courseKey, A.key);
});

test("los textos del diseño con los cursos sumados, y las claves que ya están", () => {
  const values = { "course.displayName": "7° A", "course.studentList": serializeClassListGroups([propio]) };
  const next = valoresConCursos(values, disponibles, [B.key]);
  const grupos = parseClassListGroups(next["course.studentList"]);
  assert.equal(grupos.length, 2);
  assert.deepEqual(clavesDeCursosSumados(grupos, disponibles), [B.key]);
  // Sin listado, no se inventa uno.
  assert.deepEqual(valoresConCursos({ "student.fullName": "Ana" }, disponibles, [B.key]), { "student.fullName": "Ana" });
});

test("aviso de mucha gente en la grupal: compara con todos los alumnos del listado", () => {
  assert.deepEqual(avisoDeMuchaGente(40, [propio]), { caras: 40, alumnos: 20 });
  assert.equal(avisoDeMuchaGente(40, [propio, { ...B }]), null);
  assert.equal(avisoDeMuchaGente(null, [propio]), null);
});

test("la foto grupal del diseño y la opción de la plantilla", () => {
  const slots = [
    { blockId: "ind", role: "individual" },
    { blockId: "gru", role: "group" },
  ];
  assert.equal(fotoGrupalDelDiseno(slots, { ind: { photoId: 1 }, gru: { photoId: 2 } }), 2);
  assert.equal(fotoGrupalDelDiseno(slots, { gru: { photoId: null } }), null);
  const bloque = (classList: unknown) => ({
    type: "VARIABLE_TEXT",
    configJson: { variableKey: "course.studentList", classList },
  });
  assert.equal(listadoPermiteSumarCursos([bloque({})]), false);
  assert.equal(listadoPermiteSumarCursos([bloque({ allowExtraCourses: true })]), true);
});

test("el turno viaja con el curso sumado y las casillas lo muestran", () => {
  const conTurno: CursoDelAlbum = { ...C, title: "6° A", shift: "Tarde" };
  const out = armarListadoConCursos([propio], [A, B, conTurno], [conTurno.key]);
  assert.equal(out[1]!.shift, "Tarde");
  assert.equal(cursoParaElegir(conTurno).title, "6° A Turno tarde");
  assert.equal(cursoParaElegir(A).title, "7° A");
});

test("un listado viejo con «7 A» reconoce al curso del padrón «7° A»", () => {
  const viejo = { title: "7 A", students: alumnos("x", 3) };
  assert.equal(claveDelCursoPropio([viejo], disponibles), A.key);
});
