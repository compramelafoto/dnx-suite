/**
 * Selfcheck complementario — sistema de upload recuperado (aislado).
 *   pnpm --filter fotorank run test:participant-upload:recovery
 *
 * `participant-upload.selfcheck.ts` (histórico, recuperado junto al módulo) ya
 * cubre: pasos del wizard, validación básica de archivo, requisitos,
 * `canStartUpload` y mapeo de estados. Este archivo agrega lo que aquel no
 * cubría y que el bloque de recuperación necesita fijar:
 *
 *  - formateo de bytes y dimensiones;
 *  - que los errores traducidos NO filtren mensajes crudos del backend,
 *    URLs firmadas ni secretos de R2;
 *  - que el gate de carga cerrada / elegibilidad devuelva un motivo y no
 *    habilite el inicio de upload.
 *
 * Todo es lógica pura: no toca red, ni base, ni sube archivos.
 */
import { formatParticipantDate } from "../participant-experience/dates";
import { formatBytes, formatDimensions } from "./format";
import { translateUploadError } from "./error-messages";
import { buildUploadRequirementsSummary, canStartUpload, fixtureOpenUploadWindow } from "./requirements";

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

/* ---------- 1) Formateo legible ---------- */
ok(typeof formatBytes(1024) === "string" && formatBytes(1024).length > 0, "formatBytes devuelve texto legible");
ok(formatBytes(0).length > 0, "formatBytes tolera 0 sin romper");
ok(
  typeof formatDimensions(1920, 1080) === "string" && formatDimensions(1920, 1080).includes("1920"),
  "formatDimensions incluye el ancho real",
);

/* ---------- 2) Sanitización: nunca exponer detalle del backend ---------- */
/**
 * Regresión de seguridad: el wizard muestra al participante el resultado de
 * `translateUploadError`. Si esa función devolviera el mensaje crudo, se
 * filtrarían URLs firmadas de R2, hosts internos o rastros de Postgres.
 */
const CRUDOS: Array<[string, string]> = [
  ["url firmada R2", "https://bucket.r2.cloudflarestorage.com/x.jpg?X-Amz-Signature=deadbeef"],
  ["secreto", "AWS_SECRET_ACCESS_KEY=abc123"],
  ["error postgres", 'PrismaClientKnownRequestError: relation "FotorankContestEntry" does not exist'],
  ["stack", "at Object.<anonymous> (/var/task/.next/server/chunks/123.js:1:456)"],
];
for (const [etiqueta, crudo] of CRUDOS) {
  const salida = String(translateUploadError(crudo) ?? "");
  ok(salida.length > 0, `translateUploadError devuelve mensaje para ${etiqueta}`);
  ok(
    !salida.includes("X-Amz-Signature") &&
      !salida.includes("r2.cloudflarestorage.com") &&
      !salida.includes("AWS_SECRET_ACCESS_KEY") &&
      !salida.includes("PrismaClient") &&
      !salida.includes("/var/task/"),
    `translateUploadError NO filtra ${etiqueta} al participante`,
  );
}

/* ---------- 3) Gate de carga: fail-closed en cada condición ---------- */
const ventanaAbierta = fixtureOpenUploadWindow();
const baseOk = {
  registrationStatus: "CONFIRMED",
  uploadWindow: ventanaAbierta,
  uploadedCount: 0,
  maxFiles: 1,
};

// Caso feliz: sirve de control para que los casos negativos signifiquen algo.
ok(canStartUpload(baseOk).allowed === true, "inscripción confirmada + ventana abierta → permite subir");

// Inscripción no confirmada (p. ej. DRAFT / PENDING_PAYMENT) → bloqueado.
const sinConfirmar = canStartUpload({ ...baseOk, registrationStatus: "DRAFT" });
ok(sinConfirmar.allowed === false, "inscripción no confirmada → NO permite subir (fail-closed)");
ok(Boolean(sinConfirmar.reason), "inscripción no confirmada → expone motivo para el participante");

// Ventana de carga cerrada → bloqueado, con motivo.
const ventanaCerrada = canStartUpload({
  ...baseOk,
  uploadWindow: { ...ventanaAbierta, isOpen: false },
});
ok(ventanaCerrada.allowed === false, "carga cerrada → NO permite subir");
ok(Boolean(ventanaCerrada.reason), "carga cerrada → expone motivo para el participante");

/**
 * Cupo alcanzado NO bloquea, por diseño: con 1 slot el reemplazo sigue siendo
 * una operación válida y quién decide es el caller (el wizard elige entre
 * `upload-intent` y `replace`). Se fija como contrato explícito para que un
 * cambio futuro que lo convierta en bloqueo no pase inadvertido — rompería el
 * reemplazo de fotografía.
 */
const cupoLleno = canStartUpload({ ...baseOk, uploadedCount: 1, maxFiles: 1 });
ok(cupoLleno.allowed === true, "cupo alcanzado → sigue permitido (habilita REEMPLAZO, no duplica)");

// Obra congelada para jurado → bloqueado (por flag y por admissionStatus).
ok(
  canStartUpload({ ...baseOk, frozen: true }).allowed === false,
  "obra congelada (frozen) → NO permite cargar ni reemplazar",
);
ok(
  canStartUpload({ ...baseOk, admissionStatus: "FROZEN_FOR_JURY" }).allowed === false,
  "obra FROZEN_FOR_JURY → NO permite cargar ni reemplazar",
);

/* ---------- 4) Zona horaria: evita romper la hidratación ---------- */
/**
 * Detectado en QA sobre producción: el wizard mostraba el cierre de carga con
 * hora pero sin zona horaria. `Intl.DateTimeFormat` cae entonces en la zona del
 * entorno —UTC en el servidor, la del participante en el navegador—, los dos
 * textos difieren y React aborta la hidratación (error #418). Además la hora
 * mostrada no era la del concurso.
 *
 * El resumen debe transportar la zona para que el componente formatee con ella.
 */
{
  const conZona = buildUploadRequirementsSummary({
    contestSlug: "santa-fe-en-foco",
    categoryName: "Fotógrafo Profesional",
    categorySlug: "fotografo-profesional",
    maxFiles: 1,
    uploadPolicyJson: null,
    uploadWindow: fixtureOpenUploadWindow(),
    basesHref: "/concursos/santa-fe-en-foco#bases",
    timezone: "America/Argentina/Buenos_Aires",
  });
  ok(
    conZona.timezone === "America/Argentina/Buenos_Aires",
    "el resumen transporta la zona horaria del concurso",
  );

  const sinZona = buildUploadRequirementsSummary({
    contestSlug: "otro-concurso",
    categoryName: "General",
    categorySlug: "general",
    maxFiles: 1,
    uploadPolicyJson: null,
    uploadWindow: fixtureOpenUploadWindow(),
    basesHref: "/concursos/otro#bases",
  });
  ok(sinZona.timezone === null, "sin zona declarada queda null, no undefined");
}

/* ---------- 5) Hora en 24 h: medianoche no se confunde con mediodía ---------- */
/**
 * Un cierre a las 00:00 se mostraba como "12:00 a. m.", que se lee fácilmente
 * como mediodía: el participante creería tener doce horas más de plazo. Con
 * reloj de 24 h medianoche y mediodía son textos distintos, y ya no dependen de
 * que alguien note el sufijo "a. m." / "p. m.".
 */
{
  const TZ = "America/Argentina/Buenos_Aires";
  const medianoche = formatParticipantDate(new Date("2026-10-01T03:00:00.000Z"), {
    includeTime: true,
    timeZone: TZ,
  });
  const mediodia = formatParticipantDate(new Date("2026-10-01T15:00:00.000Z"), {
    includeTime: true,
    timeZone: TZ,
  });

  ok(String(medianoche).includes("00:00"), "medianoche se muestra como 00:00");
  ok(String(mediodia).includes("12:00"), "mediodía se muestra como 12:00");
  ok(medianoche !== mediodia, "medianoche y mediodía NO producen el mismo texto");
  ok(
    !/a\.\s?m\.|p\.\s?m\./i.test(String(medianoche)),
    "el plazo no depende del sufijo a. m. / p. m.",
  );

  // Sin hora, el formato de fecha no cambia.
  ok(
    String(formatParticipantDate(new Date("2026-10-01T03:00:00.000Z"), { timeZone: TZ })) ===
      "1 de octubre de 2026",
    "sin includeTime la fecha sigue igual que antes",
  );
}

console.log("FINAL: PASS");
