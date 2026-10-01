import test from "node:test";
import assert from "node:assert/strict";

import { cuentaDeJuradoAbreElPanel } from "./judge-panel-entry";

test("una cuenta activa abre el panel", () => {
  assert.equal(cuentaDeJuradoAbreElPanel("ACTIVE"), true);
});

test("una cuenta invitada también lo abre: es por donde acepta la invitación", () => {
  assert.equal(cuentaDeJuradoAbreElPanel("INVITED"), true);
});

test("sin cuenta de jurado no hay entrada en el menú", () => {
  assert.equal(cuentaDeJuradoAbreElPanel(null), false);
  assert.equal(cuentaDeJuradoAbreElPanel(undefined), false);
});

test("una cuenta suspendida o dada de baja no abre el panel", () => {
  assert.equal(cuentaDeJuradoAbreElPanel("SUSPENDED"), false);
  assert.equal(cuentaDeJuradoAbreElPanel("DISABLED"), false);
});

test("PENDING_REGISTRATION no abre el panel: todavía no terminó de darse de alta", () => {
  assert.equal(cuentaDeJuradoAbreElPanel("PENDING_REGISTRATION"), false);
});

test("un estado desconocido no abre el panel: ante la duda, no se muestra", () => {
  assert.equal(cuentaDeJuradoAbreElPanel("ESTADO_NUEVO_QUE_NADIE_PREVIO"), false);
  assert.equal(cuentaDeJuradoAbreElPanel(""), false);
});
