import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DIPLOMA_ERROR_MESSAGES, type DiplomaErrorCode } from "../diploma-types";
import {
  deriveDiplomaRowState,
  presentDiplomaEmailState,
  presentDiplomaFailureReason,
  presentDiplomaRowState,
  type DiplomaEmailRowState,
  type DiplomaRowState,
} from "./diploma-row-presentation";

const TODOS: DiplomaRowState[] = ["no_generado", "en_proceso", "fallido", "emitido"];

describe("cómo se muestra el estado de un diploma en el panel", () => {
  it("todos los estados tienen etiqueta", () => {
    for (const state of TODOS) {
      const p = presentDiplomaRowState(state, null);
      assert.ok(p.label.length > 0, `${state} sin etiqueta`);
    }
  });

  it("sólo el estado fallido lleva motivo", () => {
    for (const state of TODOS) {
      const p = presentDiplomaRowState(state, "DIPLOMA_TEMPLATE_MISSING");
      if (state === "fallido") {
        assert.ok(p.reason && p.reason.length > 0, `${state} debería tener motivo`);
      } else {
        assert.equal(p.reason, null, `${state} no debería tener motivo`);
      }
    }
  });

  it("un motivo conocido usa el texto ya escrito en DIPLOMA_ERROR_MESSAGES, no uno nuevo", () => {
    for (const code of Object.keys(DIPLOMA_ERROR_MESSAGES) as DiplomaErrorCode[]) {
      assert.equal(presentDiplomaFailureReason(code), DIPLOMA_ERROR_MESSAGES[code]);
    }
  });

  it("un motivo desconocido o ausente no revienta: usa un texto de reserva", () => {
    const sinCodigo = presentDiplomaFailureReason(null);
    const codigoRaro = presentDiplomaFailureReason("ALGO_QUE_NO_EXISTE");
    assert.ok(sinCodigo.length > 20);
    assert.equal(sinCodigo, codigoRaro);
  });

  it("emitido es un tono de éxito y fallido uno de peligro", () => {
    assert.equal(presentDiplomaRowState("emitido", null).tone, "success");
    assert.equal(presentDiplomaRowState("fallido", null).tone, "danger");
  });
});

describe("derivar el estado de fila desde la pieza de cola", () => {
  it("sin pieza, no se generó todavía", () => {
    assert.equal(deriveDiplomaRowState(null), "no_generado");
  });

  it("READY es emitido", () => {
    assert.equal(deriveDiplomaRowState({ status: "READY" }), "emitido");
  });

  it("FAILED es fallido", () => {
    assert.equal(deriveDiplomaRowState({ status: "FAILED" }), "fallido");
  });

  it("GENERATING es en proceso", () => {
    assert.equal(deriveDiplomaRowState({ status: "GENERATING" }), "en_proceso");
  });

  it("un estado que el flujo de diplomas no produce hoy no revienta la pantalla", () => {
    assert.equal(deriveDiplomaRowState({ status: "STALE" }), "en_proceso");
    assert.equal(deriveDiplomaRowState({ status: "DELETED" }), "en_proceso");
  });
});

describe("cómo se muestra el estado del correo del diploma", () => {
  const TODOS_EMAIL: DiplomaEmailRowState[] = ["NOT_SENT", "QUEUED", "SENT", "BOUNCED", "NO_EMAIL"];

  it("sin diploma emitido todavía, no hay nada que mostrar", () => {
    assert.equal(presentDiplomaEmailState(null), null);
  });

  it("todos los estados conocidos tienen etiqueta", () => {
    for (const state of TODOS_EMAIL) {
      const p = presentDiplomaEmailState(state);
      assert.ok(p && p.label.length > 0, `${state} sin etiqueta`);
    }
  });

  it("dice 'enviado', no 'recibido': ese estado sólo confirma que se le entregó a Resend", () => {
    const p = presentDiplomaEmailState("SENT");
    assert.equal(p?.label, "Enviado");
    assert.ok(!p?.label.toLowerCase().includes("recibi"));
  });

  it("un rebote es tono de peligro; enviado es de éxito", () => {
    assert.equal(presentDiplomaEmailState("BOUNCED")?.tone, "danger");
    assert.equal(presentDiplomaEmailState("SENT")?.tone, "success");
  });

  it("un estado que el modelo (String libre) no produce hoy no revienta la pantalla", () => {
    const p = presentDiplomaEmailState("ALGO_QUE_NO_EXISTE");
    assert.ok(p && p.label.length > 0);
    assert.equal(p?.tone, "neutral");
  });

  it("QUEUED normal (sin dead) sigue diciendo 'En cola'", () => {
    const p = presentDiplomaEmailState("QUEUED", false);
    assert.equal(p?.label, "En cola");
    assert.equal(p?.tone, "warning");
  });

  it("QUEUED + dead deja de decir 'En cola': el evento agotó sus reintentos y no se va a mandar solo", () => {
    const p = presentDiplomaEmailState("QUEUED", true);
    assert.notEqual(p?.label, "En cola");
    assert.equal(p?.tone, "danger");
  });

  it("dead sólo importa si el estado es QUEUED: un SENT o BOUNCED no lo pisa", () => {
    assert.equal(presentDiplomaEmailState("SENT", true)?.label, "Enviado");
    assert.equal(presentDiplomaEmailState("BOUNCED", true)?.label, "No se pudo enviar");
  });
});
