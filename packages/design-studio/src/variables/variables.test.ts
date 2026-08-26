import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateUtc } from "./dates";
import { interpolate, resolveVariables } from "./resolve";
import type { VariableContract } from "./contract";

const contrato: VariableContract = {
  variables: [
    { key: "fullName", type: "text", label: "Nombre completo", required: true, sampleValue: "Daniel Cuart", maxLength: 40 },
    { key: "memberNumber", type: "number", label: "Número de socio", required: true, sampleValue: "128", decimals: 0 },
    { key: "validUntil", type: "date", label: "Vigente hasta", required: true, sampleValue: "2028-08-26", dateFormat: "es-AR-short" },
    { key: "verificationUrl", type: "qrPayload", label: "Enlace de verificación", required: true, sampleValue: "https://fotoffice.com/c/AB12CD34" },
    { key: "category", type: "text", label: "Categoría", required: false, sampleValue: "Activo" },
  ],
};

test("resuelve todas las variables presentes", () => {
  const r = resolveVariables(contrato, {
    fullName: "Daniel Cuart",
    memberNumber: 128,
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
    category: "Activo",
  });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.values.fullName, "Daniel Cuart");
  assert.equal(r.value.values.memberNumber, "128");
  assert.equal(r.value.values.validUntil, "26/08/2028");
  assert.equal(r.value.omitted.length, 0);
});

test("una variable requerida ausente hace fallar y dice cual es", () => {
  const r = resolveVariables(contrato, {
    memberNumber: 128,
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /Nombre completo/);
  assert.match(r.errors.join(" "), /fullName/);
});

test("una cadena vacia cuenta como ausente, no como valor", () => {
  const r = resolveVariables(contrato, {
    fullName: "   ",
    memberNumber: 128,
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, false);
});

test("una variable opcional ausente queda vacia y registrada", () => {
  const r = resolveVariables(contrato, {
    fullName: "Daniel Cuart",
    memberNumber: 128,
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.values.category, "");
  assert.deepEqual(r.value.omitted, ["category"]);
});

test("rechaza un numero que no es un numero", () => {
  const r = resolveVariables(contrato, {
    fullName: "Daniel Cuart",
    memberNumber: "ciento veintiocho",
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /Número de socio/);
});

test("rechaza una fecha invalida", () => {
  const r = resolveVariables(contrato, {
    fullName: "Daniel Cuart",
    memberNumber: 128,
    validUntil: "no soy una fecha",
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, false);
});

test("los formatos de fecha son deterministas y en UTC", () => {
  const d = new Date(Date.UTC(2028, 0, 5));
  assert.equal(formatDateUtc(d, "es-AR-short"), "05/01/2028");
  assert.equal(formatDateUtc(d, "es-AR-long"), "5 de enero de 2028");
  assert.equal(formatDateUtc(d, "iso"), "2028-01-05");
});

test("una fecha cerca de medianoche no se corre de dia por la zona horaria", () => {
  const d = new Date("2028-01-05T00:30:00.000Z");
  assert.equal(formatDateUtc(d, "iso"), "2028-01-05");
});

test("interpola marcadores y deja el texto fijo intacto", () => {
  const resueltas = { fullName: "Daniel Cuart", memberNumber: "128" };
  assert.equal(
    interpolate("Socio N° {{memberNumber}} — {{fullName}}", resueltas),
    "Socio N° 128 — Daniel Cuart",
  );
});

test("interpolar un marcador no declarado es un error, no una cadena vacia", () => {
  assert.throws(() => interpolate("Hola {{noExiste}}", { fullName: "Daniel" }), /noExiste/);
});
