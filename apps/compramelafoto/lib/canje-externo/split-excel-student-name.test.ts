import assert from "node:assert/strict";
import { test } from "node:test";
import { splitExcelStudentName } from "./external-preventa";

test("el Excel trae el apellido primero", () => {
  assert.deepEqual(splitExcelStudentName("Araujo Ines"), { lastName: "Araujo", firstName: "Ines" });
  assert.deepEqual(splitExcelStudentName("  Avendaño   Rufina Sol "), { lastName: "Avendaño", firstName: "Rufina Sol" });
});

test("una sola palabra queda como apellido; vacío no da nada", () => {
  assert.deepEqual(splitExcelStudentName("Pérez"), { lastName: "Pérez", firstName: "" });
  assert.equal(splitExcelStudentName("  "), null);
  assert.equal(splitExcelStudentName(null), null);
});
