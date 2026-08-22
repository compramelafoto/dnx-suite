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
import assert from "node:assert/strict";
import { formatBytes, formatDimensions } from "./format";
import { translateUploadError } from "./error-messages";
import { canStartUpload, fixtureOpenUploadWindow } from "./requirements";

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

console.log("FINAL: PASS");
