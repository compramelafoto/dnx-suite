import assert from "node:assert/strict";
import test from "node:test";

import {
  estaEnviada,
  estaResuelta,
  estaSinConfirmar,
  estadoVigenteDeConsigna,
  resolverEstadoConsigna,
} from "./prompt-state";

test("una foto confirmada está enviada", () => {
  const e = resolverEstadoConsigna({ submissionStatus: "CONFIRMED" });
  assert.equal(e, "ENVIADA");
  assert.equal(estaEnviada(e), true);
  assert.equal(estaResuelta(e), true);
});

test("una foto subida cuya entrega no se guardó no cuenta como enviada", () => {
  for (const s of ["PENDING_CONFIRMATION", "UPLOAD_PENDING", "PROCESSING"]) {
    const e = resolverEstadoConsigna({ submissionStatus: s });
    assert.equal(e, "SIN_CONFIRMAR", s);
    assert.equal(estaSinConfirmar(e), true, s);
    assert.equal(estaEnviada(e), false, `${s} no puede contar como entregada`);
  }
});

test("marcar «Ya la tengo» sin subir cuenta como resuelta, no como enviada", () => {
  const e = resolverEstadoConsigna({ solved: true });
  assert.equal(e, "YA_LA_TENGO");
  assert.equal(estaResuelta(e), true);
  assert.equal(estaEnviada(e), false);
});

test("la foto manda sobre el check: subida sin confirmar aunque no esté marcada", () => {
  const e = resolverEstadoConsigna({ submissionStatus: "PENDING_CONFIRMATION", solved: false });
  assert.equal(e, "SIN_CONFIRMAR");
});

test("sin nada, pendiente", () => {
  const e = resolverEstadoConsigna({});
  assert.equal(e, "PENDIENTE");
  assert.equal(estaResuelta(e), false);
});

test("una entrega rechazada no cuenta como resuelta", () => {
  const e = resolverEstadoConsigna({ submissionStatus: "REJECTED" });
  assert.equal(e, "RECHAZADA");
  assert.equal(estaResuelta(e), false);
});

test("el resumen toma lo que se acaba de entregar, sin recargar", () => {
  // Al abrir la pantalla la consigna estaba sin entregar.
  const estado = estadoVigenteDeConsigna({
    promptId: "p1",
    estadoDelServidor: null,
    entregadasAhora: { p1: "CONFIRMED" },
  });
  assert.equal(estado, "CONFIRMED");
  assert.equal(resolverEstadoConsigna({ submissionStatus: estado }), "ENVIADA");
});

test("sin entregas nuevas manda lo que trajo el servidor", () => {
  assert.equal(
    estadoVigenteDeConsigna({
      promptId: "p1",
      estadoDelServidor: "CONFIRMED",
      entregadasAhora: {},
    }),
    "CONFIRMED",
  );
});

test("una consigna no toca el estado de otra", () => {
  assert.equal(
    estadoVigenteDeConsigna({
      promptId: "p2",
      estadoDelServidor: null,
      entregadasAhora: { p1: "CONFIRMED" },
    }),
    null,
  );
});

test("una consigna todavía sin publicar no rompe la cuenta", () => {
  assert.equal(
    estadoVigenteDeConsigna({
      promptId: null,
      estadoDelServidor: null,
      entregadasAhora: { p1: "CONFIRMED" },
    }),
    null,
  );
});

test("las once entregadas de corrido cuentan once", () => {
  const promptIds = Array.from({ length: 11 }, (_, i) => `p${i + 1}`);
  const entregadasAhora = Object.fromEntries(promptIds.map((id) => [id, "CONFIRMED"]));
  const enviadas = promptIds.filter((promptId) =>
    estaEnviada(
      resolverEstadoConsigna({
        submissionStatus: estadoVigenteDeConsigna({
          promptId,
          estadoDelServidor: null, // el servidor todavía no se enteró de ninguna
          entregadasAhora,
        }),
      }),
    ),
  ).length;
  assert.equal(enviadas, 11);
});
