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

test("el pack puede traer el colegio; si no lo trae queda vacío", async () => {
  const { parseExternalPreventaRefs } = await import("./external-preventa");
  const con = parseExternalPreventaRefs({ kind: "EXTERNAL_PREVENTA_PACK", studentName: "Avendaño Rufina", schoolName: " Colegio San Patricio " });
  assert.equal(con?.schoolName, "Colegio San Patricio");
  const sin = parseExternalPreventaRefs({ kind: "EXTERNAL_PREVENTA_PACK", studentName: "Avendaño Rufina" });
  assert.equal(sin?.schoolName, null);
});
