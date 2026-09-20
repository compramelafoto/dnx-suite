import assert from "node:assert/strict";
import test from "node:test";

import { presentarInterruptorDeAcreditacion } from "./accreditation-switch";

/**
 * El interruptor del módulo de acreditación.
 *
 * Lo que más importa es lo que pasa al apagarlo con el evento en curso: si hay
 * gente ya acreditada, apagar deja al escáner rechazando a todo el mundo, y eso
 * tiene que avisarse antes y no después.
 */

test("apagado y sin nadie acreditado: el botón ofrece encender", () => {
  const p = presentarInterruptorDeAcreditacion({
    habilitado: false,
    ingresosRegistrados: 0,
    ventanaAbierta: false,
  });
  assert.equal(p.accion, "ENCENDER");
  assert.match(p.etiquetaDelBoton, /encender/i);
  assert.equal(p.pideConfirmacion, false);
});

test("encendido: el botón ofrece apagar", () => {
  const p = presentarInterruptorDeAcreditacion({
    habilitado: true,
    ingresosRegistrados: 0,
    ventanaAbierta: false,
  });
  assert.equal(p.accion, "APAGAR");
  assert.match(p.etiquetaDelBoton, /apagar/i);
});

test("apagar con gente ya acreditada pide confirmación", () => {
  const p = presentarInterruptorDeAcreditacion({
    habilitado: true,
    ingresosRegistrados: 12,
    ventanaAbierta: true,
  });
  assert.equal(p.accion, "APAGAR");
  assert.equal(p.pideConfirmacion, true);
  assert.match(p.textoDeConfirmacion ?? "", /12/);
});

test("apagar con la ventana abierta pide confirmación aunque no haya nadie", () => {
  const p = presentarInterruptorDeAcreditacion({
    habilitado: true,
    ingresosRegistrados: 0,
    ventanaAbierta: true,
  });
  assert.equal(p.pideConfirmacion, true);
});

test("encender nunca pide confirmación: es la acción segura", () => {
  const p = presentarInterruptorDeAcreditacion({
    habilitado: false,
    ingresosRegistrados: 40,
    ventanaAbierta: true,
  });
  assert.equal(p.accion, "ENCENDER");
  assert.equal(p.pideConfirmacion, false);
});

test("apagado con la ventana abierta avisa que el escáner está rechazando", () => {
  const p = presentarInterruptorDeAcreditacion({
    habilitado: false,
    ingresosRegistrados: 0,
    ventanaAbierta: true,
  });
  assert.equal(p.tono, "danger");
  assert.match(p.explicacion, /rechaz/i);
});

test("apagado con la ventana cerrada informa sin alarmar", () => {
  const p = presentarInterruptorDeAcreditacion({
    habilitado: false,
    ingresosRegistrados: 0,
    ventanaAbierta: false,
  });
  assert.equal(p.tono, "warning");
});

test("encendido y con la ventana abierta está todo bien", () => {
  const p = presentarInterruptorDeAcreditacion({
    habilitado: true,
    ingresosRegistrados: 5,
    ventanaAbierta: true,
  });
  assert.equal(p.tono, "success");
});

test("encendido con la ventana todavía cerrada también está bien", () => {
  const p = presentarInterruptorDeAcreditacion({
    habilitado: true,
    ingresosRegistrados: 0,
    ventanaAbierta: false,
  });
  assert.equal(p.tono, "success");
  assert.match(p.explicacion, /cuando (abra|llegue)/i);
});

test("siempre hay explicación y etiqueta legibles", () => {
  for (const habilitado of [true, false]) {
    for (const ventanaAbierta of [true, false]) {
      const p = presentarInterruptorDeAcreditacion({
        habilitado,
        ingresosRegistrados: 0,
        ventanaAbierta,
      });
      assert.ok(p.explicacion.trim().length > 0);
      assert.ok(p.etiquetaDelBoton.trim().length > 0);
      assert.ok(p.estado.trim().length > 0);
    }
  }
});
