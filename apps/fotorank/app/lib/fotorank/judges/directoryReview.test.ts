/**
 * Cuatro puertas separadas: poder entrar, estar en la lista, tener página
 * pública y estar verificado. Confundirlas publica a alguien que nadie revisó.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  estadoInicialParaAlta,
  estaEnLaColaDeRevision,
  aprobar,
  rechazar,
  volverAPedirRevision,
  listadoSegunLoQuePide,
} from "./directoryReview";

test("quien se postula solo nace pendiente y no público", () => {
  assert.deepEqual(estadoInicialParaAlta("PUBLIC_SIGNUP"), { estado: "PENDING", isPublic: false });
});

test("a quien carga un organizador nace aprobado: ese organizador respondió por él", () => {
  assert.deepEqual(estadoInicialParaAlta("ORGANIZER_CREATED"), { estado: "APPROVED", isPublic: true });
  assert.deepEqual(estadoInicialParaAlta("ORGANIZER_INVITATION"), { estado: "APPROVED", isPublic: true });
});

test("sin el email verificado no entra a la cola", () => {
  assert.equal(
    estaEnLaColaDeRevision({ estado: "PENDING", emailVerificado: false, quiereEstarEnElDirectorio: true }),
    false,
  );
  assert.equal(
    estaEnLaColaDeRevision({ estado: "PENDING", emailVerificado: true, quiereEstarEnElDirectorio: true }),
    true,
  );
});

test("un perfil ya aprobado no vuelve a la cola", () => {
  assert.equal(
    estaEnLaColaDeRevision({ estado: "APPROVED", emailVerificado: true, quiereEstarEnElDirectorio: true }),
    false,
  );
});

test("aprobar publica la página, y el directorio sólo si lo pidió", () => {
  assert.deepEqual(
    aprobar({ estado: "PENDING", emailVerificado: true, quiereEstarEnElDirectorio: true }),
    { estado: "APPROVED", isPublic: true, isListedInProfessionalDirectory: true },
  );
  assert.deepEqual(
    aprobar({ estado: "PENDING", emailVerificado: true, quiereEstarEnElDirectorio: false }),
    { estado: "APPROVED", isPublic: true, isListedInProfessionalDirectory: false },
  );
});

test("rechazar exige un motivo", () => {
  const p = { estado: "PENDING" as const, emailVerificado: true, quiereEstarEnElDirectorio: true };
  const sinMotivo = rechazar(p, "   ");
  assert.equal(sinMotivo.ok, false);
  const conMotivo = rechazar(p, "La bio no describe experiencia en jurados.");
  assert.equal(conMotivo.ok, true);
  assert.deepEqual(conMotivo.ok && conMotivo.efecto, {
    estado: "REJECTED",
    isPublic: false,
    isListedInProfessionalDirectory: false,
  });
});

test("un rechazado puede corregir y volver a pedir revisión", () => {
  const r = volverAPedirRevision({
    estado: "REJECTED",
    emailVerificado: true,
    quiereEstarEnElDirectorio: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.efecto.estado, "PENDING");
});

test("un aprobado no puede volver a pedir revisión", () => {
  const r = volverAPedirRevision({
    estado: "APPROVED",
    emailVerificado: true,
    quiereEstarEnElDirectorio: true,
  });
  assert.equal(r.ok, false);
});

/**
 * La regla que faltaba y dejó a una jurado aprobada fuera del directorio
 * durante un día: pidió aparecer después de la aprobación y nada la publicó.
 */
test("una ficha aprobada que pide aparecer, aparece", () => {
  assert.equal(
    listadoSegunLoQuePide({ estado: "APPROVED", quiereEstarEnElDirectorio: true }),
    true,
  );
});

test("una ficha aprobada que pide salir, sale", () => {
  assert.equal(
    listadoSegunLoQuePide({ estado: "APPROVED", quiereEstarEnElDirectorio: false }),
    false,
  );
});

test("sin aprobar, pedirlo no publica nada", () => {
  for (const estado of ["PENDING", "REJECTED"] as const) {
    assert.equal(
      listadoSegunLoQuePide({ estado, quiereEstarEnElDirectorio: true }),
      false,
      `${estado} no debería publicarse por pedirlo`,
    );
  }
});

test("la aprobación y el pedido posterior llegan al mismo lugar", () => {
  // Lo que decide `aprobar` y lo que decide un guardado posterior tienen que
  // coincidir: si no, la ficha cambiaría sola al editar cualquier otro campo.
  const efecto = aprobar({
    estado: "PENDING",
    emailVerificado: true,
    quiereEstarEnElDirectorio: true,
  });
  assert.equal(
    efecto.isListedInProfessionalDirectory,
    listadoSegunLoQuePide({ estado: "APPROVED", quiereEstarEnElDirectorio: true }),
  );
});
