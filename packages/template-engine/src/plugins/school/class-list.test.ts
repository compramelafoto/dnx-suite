import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CLASS_LIST_OPTIONS,
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
