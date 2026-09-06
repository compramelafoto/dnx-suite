/**
 * Selfcheck — reenvío de declaraciones de carga (wizard → API).
 *   pnpm --filter fotorank run test:entries:eligibility-form
 *
 * Regresión que fija: las rutas `upload` y `replace` armaban el objeto de
 * elegibilidad a mano y omitían autoría, política de edición, IA generativa e
 * Instagram. El wizard sí los enviaba en el FormData, pero se perdían en la
 * ruta, así que `processUploadedFile` los recibía vacíos y rechazaba con
 * DECLARATIONS_REQUIRED / INSTAGRAM_REQUIRED — sin ninguna forma de
 * satisfacerlos desde la interfaz. En Santa Fe eso bloqueaba toda subida.
 *
 * Va en archivo propio y no dentro de `entries.selfcheck.ts` porque ese script
 * no se puede ejecutar hoy: usa top-level await, que el runner (tsx en formato
 * CJS) rechaza al transformar. Es un fallo preexistente y ajeno a este cambio,
 * así que ese archivo se dejó intacto en lugar de modificarlo de paso.
 *
 * Lógica pura: no toca red, ni base, ni sube archivos.
 */
import { parseEntryEligibilityFormData, parseEntryEligibilityJson } from "./eligibility-form";

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

/* ---------- 1) El FormData del wizard llega completo ---------- */
const fd = new FormData();
fd.set("captureLocality", "Rosario");
fd.set("captureDepartment", "Rosario");
fd.set("territoryConfirmedSantaFe", "1");
fd.set("declaredDeviceKind", "DSLR");
fd.set("declaredDeviceMake", "Canon");
fd.set("declaredDeviceModel", "EOS R6");
fd.set("captureWithinPeriodDeclared", "1");
fd.set("authorshipDeclared", "1");
fd.set("editingPolicyDeclared", "1");
fd.set("noGenerativeAiDeclared", "1");
fd.set("droneRegulationAcknowledged", "1");
fd.set("instagramHandle", "@qa_test");

const parsed = parseEntryEligibilityFormData(fd);

// Las tres declaraciones legales: son las que bloqueaban con DECLARATIONS_REQUIRED.
ok(parsed.authorshipDeclared === true, "reenvía la declaración de autoría");
ok(parsed.editingPolicyDeclared === true, "reenvía la declaración de política de edición");
ok(parsed.noGenerativeAiDeclared === true, "reenvía la declaración de no-IA generativa");
// Instagram: bloqueaba con INSTAGRAM_REQUIRED.
ok(parsed.instagramHandle === "@qa_test", "reenvía el usuario de Instagram");
// Elegibilidad territorial y de dispositivo, que ya viajaban y no deben perderse.
ok(parsed.captureLocality === "Rosario", "reenvía la localidad de captura");
ok(parsed.captureDepartment === "Rosario", "reenvía el departamento de captura");
ok(parsed.territoryConfirmedSantaFe === true, "reenvía la confirmación de territorio Santa Fe");
ok(parsed.declaredDeviceKind === "DSLR", "reenvía el tipo de dispositivo declarado");
ok(parsed.declaredDeviceMake === "Canon", "reenvía la marca del dispositivo");
ok(parsed.declaredDeviceModel === "EOS R6", "reenvía el modelo del dispositivo");
ok(parsed.captureWithinPeriodDeclared === true, "reenvía la declaración de período de captura");
ok(parsed.droneRegulationAcknowledged === true, "reenvía el reconocimiento de normativa de dron");

/* ---------- 2) Fail-closed: nada se declara por omisión ---------- */
const empty = parseEntryEligibilityFormData(new FormData());
ok(empty.authorshipDeclared === false, "FormData vacío → autoría NO declarada");
ok(empty.editingPolicyDeclared === false, "FormData vacío → edición NO declarada");
ok(empty.noGenerativeAiDeclared === false, "FormData vacío → no-IA NO declarada");
ok(empty.territoryConfirmedSantaFe === false, "FormData vacío → territorio NO confirmado");
ok(empty.captureWithinPeriodDeclared === false, "FormData vacío → período NO declarado");
ok(empty.droneRegulationAcknowledged === false, "FormData vacío → normativa de dron NO reconocida");
ok(empty.instagramHandle === null, "FormData vacío → Instagram nulo, no cadena vacía");
ok(empty.declaredDeviceKind === null, "FormData vacío → dispositivo nulo");

/* ---------- 3) Sólo "1"/"true" afirman ---------- */
/**
 * Importante para el fail-closed: un checkbox sin marcar puede llegar como "0",
 * "false" o ausente. Ninguno debe contar como declaración firmada.
 */
for (const raw of ["0", "false", "sí", "on", "", "null", "undefined"]) {
  const fdRaw = new FormData();
  fdRaw.set("authorshipDeclared", raw);
  fdRaw.set("territoryConfirmedSantaFe", raw);
  const p = parseEntryEligibilityFormData(fdRaw);
  ok(p.authorshipDeclared === false, `"${raw}" NO cuenta como autoría declarada`);
  ok(p.territoryConfirmedSantaFe === false, `"${raw}" NO cuenta como territorio confirmado`);
}

// "true" sí afirma (el wizard usa "1", pero el contrato acepta ambos).
const fdTrue = new FormData();
fdTrue.set("authorshipDeclared", "true");
ok(parseEntryEligibilityFormData(fdTrue).authorshipDeclared === true, '"true" sí afirma');

/* ---------- 4) Un archivo en un campo de texto no se cuela ---------- */
const fdFile = new FormData();
fdFile.set("instagramHandle", new File(["x"], "x.txt"));
ok(
  parseEntryEligibilityFormData(fdFile).instagramHandle === null,
  "un File en un campo de texto se descarta (no se serializa como objeto)",
);

/* ---------- 5) El parser JSON declara exactamente lo mismo ---------- */
/**
 * La subida directa cierra con un pedido JSON (el archivo ya viajó al bucket),
 * así que hay dos parsers para el mismo formulario. Si divergen, las
 * declaraciones se pierden en un solo camino y el participante recibe
 * DECLARATIONS_REQUIRED sin poder hacer nada — exactamente la regresión que
 * este archivo existe para impedir.
 */
const jsonEquivalente = parseEntryEligibilityJson({
  captureLocality: "Rosario",
  captureDepartment: "Rosario",
  territoryConfirmedSantaFe: true,
  declaredDeviceKind: "DSLR",
  declaredDeviceMake: "Canon",
  declaredDeviceModel: "EOS R6",
  captureWithinPeriodDeclared: true,
  authorshipDeclared: true,
  editingPolicyDeclared: true,
  noGenerativeAiDeclared: true,
  droneRegulationAcknowledged: true,
  instagramHandle: "@qa_test",
});
ok(
  JSON.stringify(jsonEquivalente) === JSON.stringify(parsed),
  "JSON y FormData producen la misma elegibilidad ante el mismo formulario",
);

// Fail-closed también en JSON.
const jsonEmpty = parseEntryEligibilityJson({});
ok(jsonEmpty.authorshipDeclared === false, "JSON vacío → autoría NO declarada");
ok(jsonEmpty.editingPolicyDeclared === false, "JSON vacío → edición NO declarada");
ok(jsonEmpty.noGenerativeAiDeclared === false, "JSON vacío → no-IA NO declarada");
ok(jsonEmpty.territoryConfirmedSantaFe === false, "JSON vacío → territorio NO confirmado");
ok(jsonEmpty.instagramHandle === null, "JSON vacío → Instagram nulo");

// Un cuerpo ausente o de otro tipo no puede afirmar nada.
for (const raw of [null, undefined, "texto", 42, []]) {
  const p = parseEntryEligibilityJson(raw);
  ok(p.authorshipDeclared === false, `cuerpo ${JSON.stringify(raw) ?? "undefined"} → autoría NO declarada`);
}

// Los flags sólo aceptan true real (o el "1"/"true" heredado del FormData).
for (const raw of [false, 0, 1, "0", "sí", "null", null, {}]) {
  const p = parseEntryEligibilityJson({ authorshipDeclared: raw, territoryConfirmedSantaFe: raw });
  ok(p.authorshipDeclared === false, `${JSON.stringify(raw)} NO cuenta como autoría declarada (JSON)`);
  ok(p.territoryConfirmedSantaFe === false, `${JSON.stringify(raw)} NO cuenta como territorio (JSON)`);
}

// Un objeto anidado en un campo de texto se descarta, como el File en FormData.
ok(
  parseEntryEligibilityJson({ instagramHandle: { toString: "@x" } }).instagramHandle === null,
  "un objeto en un campo de texto se descarta (JSON)",
);

console.log("FINAL: PASS");
