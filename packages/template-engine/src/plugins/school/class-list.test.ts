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

test("opciones guardadas inválidas vuelven a los valores por defecto", () => {
  assert.deepEqual(readClassListOptions({ classList: { columns: 99, sortBy: "x" } }), {
    ...DEFAULT_CLASS_LIST_OPTIONS,
    columns: 4,
  });
});
