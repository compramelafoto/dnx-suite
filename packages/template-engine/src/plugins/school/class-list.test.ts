import assert from "node:assert/strict";
import test from "node:test";
import {
  classListCrowdMessage,
  classListCrowdWarning,
  DEFAULT_CLASS_LIST_OPTIONS,
  layoutClassListBlock,
  parseClassListGroups,
  serializeClassListGroups,
  formatClassList,
  layoutClassList,
  parseClassListValue,
  readClassListOptions,
  serializeClassList,
  type ClassListStudent,
} from "./class-list";

const curso: ClassListStudent[] = [
  { firstName: "Daniel", lastName: "Pérez", isOwner: true },
  { firstName: "Ana Sofía", lastName: "Álvarez" },
  { firstName: "Bruno", lastName: "Zárate" },
];

test("ida y vuelta por el texto de la variable", () => {
  assert.deepEqual(parseClassListValue(serializeClassList(curso)), curso);
  assert.deepEqual(parseClassListValue("María Gómez"), []);
  assert.deepEqual(parseClassListValue("[roto"), []);
});

test("ordena por apellido sin que los acentos alteren el orden", () => {
  const lines = formatClassList(curso, { ...DEFAULT_CLASS_LIST_OPTIONS, sortBy: "lastName" });
  assert.deepEqual(
    lines.map((l) => l.text),
    ["Ana Sofía Álvarez", "Daniel Pérez", "Bruno Zárate"],
  );
});

test("ordena por nombre y escribe apellido primero", () => {
  const lines = formatClassList(curso, {
    ...DEFAULT_CLASS_LIST_OPTIONS,
    sortBy: "firstName",
    nameOrder: "lastFirst",
  });
  assert.deepEqual(
    lines.map((l) => l.text),
    ["Álvarez, Ana Sofía", "Zárate, Bruno", "Pérez, Daniel"],
  );
});

test("sólo el primer nombre", () => {
  const lines = formatClassList(curso, { ...DEFAULT_CLASS_LIST_OPTIONS, givenNames: "first" });
  assert.equal(lines[0]!.text, "Ana Álvarez");
});

test("el dueño del diseño va en negrita sólo si se pide", () => {
  const on = formatClassList(curso, { ...DEFAULT_CLASS_LIST_OPTIONS, highlightOwner: true });
  assert.deepEqual(on.filter((l) => l.bold).map((l) => l.text), ["Daniel Pérez"]);
  const off = formatClassList(curso, { ...DEFAULT_CLASS_LIST_OPTIONS, highlightOwner: false });
  assert.equal(off.some((l) => l.bold), false);
});

test("reparte en columnas de arriba hacia abajo y achica si no entra", () => {
  const lines = Array.from({ length: 10 }, (_, i) => ({ text: `A${i}`, bold: false }));
  const { cells, fontSize } = layoutClassList({ lines, width: 1000, height: 100, fontSize: 40, lineHeight: 1.25, columns: 2 });
  // 5 filas en 100 px: 20 px por fila → cuerpo 16.
  assert.equal(fontSize, 16);
  assert.equal(cells[4]!.x, 0);
  assert.ok(cells[5]!.x > 0);
  assert.equal(cells[5]!.y, 0);
  const amplio = layoutClassList({ lines, width: 1000, height: 10_000, fontSize: 40, lineHeight: 1.25, columns: 2 });
  assert.equal(amplio.fontSize, 40);
});

test("alineación vertical: las columnas se mueven juntas y reparten el hueco", () => {
  // 7 alumnos en 2 columnas: 4 filas de 50 px (cuerpo 40 × 1,25) = 200 px en una caja de 1000.
  const lines = Array.from({ length: 7 }, (_, i) => ({ text: `A${i}`, bold: false }));
  const base = { lines, width: 1000, height: 1000, fontSize: 40, lineHeight: 1.25, columns: 2 };
  const arriba = layoutClassList(base);
  assert.equal(arriba.cells[0]!.y, 0);
  assert.deepEqual(layoutClassList({ ...base, verticalAlign: "top" }), arriba);
  const centro = layoutClassList({ ...base, verticalAlign: "middle" });
  // Sobran 800 px: 400 arriba y 400 abajo. La segunda columna arranca a la misma altura.
  assert.equal(centro.cells[0]!.y, 400);
  assert.equal(centro.cells[4]!.y, 400);
  assert.equal(centro.cells[3]!.y + centro.cells[3]!.height, 600);
  const abajo = layoutClassList({ ...base, verticalAlign: "bottom" });
  assert.equal(abajo.cells[3]!.y + abajo.cells[3]!.height, 1000);
  // Si la lista se achicó para entrar, no hay hueco y no se mueve.
  const justa = layoutClassList({ ...base, height: 100, verticalAlign: "middle" });
  assert.equal(justa.cells[0]!.y, 0);
});

test("opciones guardadas inválidas vuelven a los valores por defecto", () => {
  assert.deepEqual(readClassListOptions({ classList: { columns: 99, sortBy: "x" } }), {
    ...DEFAULT_CLASS_LIST_OPTIONS,
    columns: 4,
  });
});

test("varios cursos: ida y vuelta y los listados viejos se leen como un curso", () => {
  const grupos = [
    { title: "7.° A", courseKey: "k-a", students: curso },
    { title: "7.° B", students: [{ firstName: "Lía", lastName: "Ruiz" }] },
  ];
  assert.deepEqual(parseClassListGroups(serializeClassListGroups(grupos)), grupos);
  // Viejo: arreglo plano → un curso con el título que se le pase.
  assert.deepEqual(parseClassListGroups(serializeClassList(curso), " 7.° A "), [{ title: "7.° A", students: curso }]);
  assert.deepEqual(parseClassListGroups(serializeClassList(curso)), [{ title: "", students: curso }]);
  // Todos los alumnos juntos, para quien sólo quiere la lista.
  assert.equal(parseClassListValue(serializeClassListGroups(grupos)).length, 4);
  assert.deepEqual(parseClassListGroups("{roto"), []);
  assert.deepEqual(parseClassListGroups('{"g":[{"t":"vacío","s":[]}]}'), []);
});

test("el título del curso va siempre, arriba y a todo el ancho, más grande y en negrita", () => {
  const opciones = readClassListOptions({});
  assert.equal(opciones.showHeading, true);
  assert.equal(opciones.allowExtraCourses, false);
  const { cells, fontSize } = layoutClassListBlock({
    groups: [{ title: "7.° A", students: curso }],
    options: opciones,
    width: 1000,
    height: 10_000,
    fontSize: 40,
    lineHeight: 1.25,
  });
  assert.equal(fontSize, 40);
  const titulo = cells[0]!;
  assert.equal(titulo.text, "7.° A");
  assert.equal(titulo.heading, true);
  assert.equal(titulo.bold, true);
  assert.equal(titulo.width, 1000);
  assert.equal(titulo.fontSize, 48);
  // Los alumnos arrancan debajo del título.
  assert.equal(cells[1]!.y, titulo.height);
  // Sin título si se apaga.
  const sin = layoutClassListBlock({
    groups: [{ title: "7.° A", students: curso }],
    options: { ...opciones, showHeading: false },
    width: 1000,
    height: 10_000,
    fontSize: 40,
    lineHeight: 1.25,
  });
  assert.equal(sin.cells.some((c) => c.heading), false);
});

test("dos cursos: un título y sus alumnos por curso, y todo se achica junto si no entra", () => {
  const groups = [
    { title: "7.° A", students: Array.from({ length: 4 }, (_, i) => ({ firstName: `A${i}`, lastName: "X" })) },
    { title: "7.° B", students: Array.from({ length: 4 }, (_, i) => ({ firstName: `B${i}`, lastName: "Y" })) },
  ];
  const options = { ...DEFAULT_CLASS_LIST_OPTIONS, columns: 2, headingScale: 1 };
  // Natural: 2 títulos + 2×2 filas + medio renglón = 6,5 renglones de 50 px = 325 px.
  const amplio = layoutClassListBlock({ groups, options, width: 1000, height: 1000, fontSize: 40, lineHeight: 1.25 });
  assert.deepEqual(
    amplio.cells.filter((c) => c.heading).map((c) => c.text),
    ["7.° A", "7.° B"],
  );
  const tituloB = amplio.cells.find((c) => c.text === "7.° B")!;
  assert.equal(tituloB.y, 50 + 100 + 25);
  const justo = layoutClassListBlock({ groups, options, width: 1000, height: 162.5, fontSize: 40, lineHeight: 1.25 });
  assert.equal(justo.fontSize, 20);
  const ultima = justo.cells[justo.cells.length - 1]!;
  assert.ok(Math.abs(ultima.y + ultima.height - 162.5) < 1e-9);
});

test("un solo curso sin título reparte igual que antes", () => {
  const students = Array.from({ length: 7 }, (_, i) => ({ firstName: `N${i}`, lastName: "" }));
  const base = { width: 1000, height: 100, fontSize: 40, lineHeight: 1.25 };
  const viejo = layoutClassList({ ...base, lines: formatClassList(students, DEFAULT_CLASS_LIST_OPTIONS), columns: 2 });
  const nuevo = layoutClassListBlock({ ...base, groups: [{ title: "", students }], options: DEFAULT_CLASS_LIST_OPTIONS });
  assert.equal(nuevo.fontSize, viejo.fontSize);
  assert.deepEqual(
    nuevo.cells.map(({ x, y, width, height, text }) => ({ x, y, width, height, text })),
    viejo.cells.map(({ x, y, width, height, text }) => ({ x, y, width, height, text })),
  );
});

test("aviso de foto con más gente que el listado: 30 % más de caras", () => {
  assert.equal(classListCrowdWarning(39, 30), true);
  assert.equal(classListCrowdWarning(38, 30), false);
  assert.equal(classListCrowdWarning(null, 30), false);
  assert.equal(classListCrowdWarning(50, 0), false);
  assert.equal(
    classListCrowdMessage(52, 25),
    "En esta foto se ven unas 52 personas y el listado tiene 25. ¿Hay más de un curso?",
  );
});
