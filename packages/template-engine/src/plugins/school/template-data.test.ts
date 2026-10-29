import assert from "node:assert/strict";
import test from "node:test";
import { applyTemplateData, readTemplateData } from "./template-data";

const bloques = [
  { id: "t", type: "VARIABLE_TEXT", configJson: { variableKey: "diploma.title", fallback: "Diploma de honor" } },
  { id: "m", type: "VARIABLE_TEXT", configJson: { variableKey: "diploma.reason", fallback: "Por su compañerismo" } },
  { id: "n", type: "VARIABLE_TEXT", configJson: { variableKey: "student.fullName", fallback: "" } },
  { id: "c1", type: "VARIABLE_TEXT", configJson: { variableKey: "calendar.grid", calendar: { year: 2027, month: 1 } } },
  { id: "c2", type: "VARIABLE_TEXT", configJson: { variableKey: "calendar.grid", calendar: { year: 2027, month: 2 } } },
  { id: "a", type: "VARIABLE_TEXT", configJson: { variableKey: "calendar.year", fallback: "2027" } },
  { id: "x", type: "TEXT", configJson: { content: "diploma.title" } },
];

test("lee sólo los datos que usa la plantilla, con su texto", () => {
  const datos = readTemplateData(bloques);
  assert.deepEqual(
    datos.map((d) => [d.key, d.value]),
    [
      ["diploma.title", "Diploma de honor"],
      ["diploma.reason", "Por su compañerismo"],
      ["calendar.year", "2027"],
    ],
  );
  assert.deepEqual(readTemplateData([bloques[2]!]), []);
});

test("un calendario sin bloque de año igual pide el año, leído del calendario", () => {
  const datos = readTemplateData([bloques[3]!]);
  assert.deepEqual(datos.map((d) => [d.key, d.value]), [["calendar.year", "2027"]]);
});

test("cambiar el título lo escribe en todos sus bloques y no toca los demás", () => {
  const otro = [...bloques, { id: "t2", type: "VARIABLE_TEXT", configJson: { variableKey: "diploma.title", fallback: "" } }];
  const nuevos = applyTemplateData(otro, "diploma.title", "Mejor compañero");
  assert.equal((nuevos.find((b) => b.id === "t")!.configJson as { fallback: string }).fallback, "Mejor compañero");
  assert.equal((nuevos.find((b) => b.id === "t2")!.configJson as { fallback: string }).fallback, "Mejor compañero");
  for (const id of ["m", "n", "c1", "a", "x"]) {
    assert.equal(nuevos.find((b) => b.id === id), otro.find((b) => b.id === id), `${id} queda igual`);
  }
});

test("cambiar el año mueve todos los calendarios y el texto del año", () => {
  const nuevos = applyTemplateData(bloques, "calendar.year", " 2028 ");
  const cal = (id: string) => (nuevos.find((b) => b.id === id)!.configJson as { calendar: { year: number; month: number } }).calendar;
  assert.deepEqual(cal("c1"), { year: 2028, month: 1 });
  assert.deepEqual(cal("c2"), { year: 2028, month: 2 });
  assert.equal((nuevos.find((b) => b.id === "a")!.configJson as { fallback: string }).fallback, "2028");
});

test("un año que no es año no cambia nada", () => {
  const nuevos = applyTemplateData(bloques, "calendar.year", "20");
  assert.deepEqual(nuevos, bloques);
});
