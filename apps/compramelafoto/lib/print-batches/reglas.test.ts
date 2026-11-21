import assert from "node:assert/strict";
import { test } from "node:test";
import {
  avisaAlCliente,
  estadoDelPedidoEnElTramo,
  estadoDelPedidoPara,
  loteCerrado,
  motivoParaNoEntrar,
  puedeMover,
  type EstadoLote,
  type PedidoCandidato,
} from "./reglas";

const R = "RETIRA_FOTOGRAFO" as const;
const E = "ENVIA_LAB" as const;

test("puedeMover: el laboratorio avanza entre ENVIADO, EN_PRODUCCION y LISTO", () => {
  assert.equal(puedeMover("ENVIADO", "EN_PRODUCCION", "LABORATORIO", R), true);
  assert.equal(puedeMover("ENVIADO", "LISTO", "LABORATORIO", R), true);
  assert.equal(puedeMover("EN_PRODUCCION", "LISTO", "LABORATORIO", R), true);
  assert.equal(puedeMover("EN_PRODUCCION", "ENVIADO", "LABORATORIO", R), false);
});

test("puedeMover: el laboratorio no toca ARMADO, RECIBIDO, CERRADO ni ANULADO", () => {
  assert.equal(puedeMover("ARMADO", "ENVIADO", "LABORATORIO", R), false);
  assert.equal(puedeMover("LISTO", "RECIBIDO", "LABORATORIO", R), false);
  assert.equal(puedeMover("DESPACHADO", "RECIBIDO", "LABORATORIO", E), false);
  assert.equal(puedeMover("LISTO", "CERRADO", "LABORATORIO", R), false);
  assert.equal(puedeMover("ENVIADO", "ANULADO", "LABORATORIO", R), false);
});

test("puedeMover: DESPACHADO sólo con ENVIA_LAB", () => {
  assert.equal(puedeMover("LISTO", "DESPACHADO", "LABORATORIO", R), false);
  assert.equal(puedeMover("LISTO", "DESPACHADO", "LABORATORIO", E), true);
  assert.equal(puedeMover("LISTO", "DESPACHADO", "FOTOGRAFO", R), false);
  assert.equal(puedeMover("LISTO", "DESPACHADO", "FOTOGRAFO", E), true);
});

test("puedeMover: el fotógrafo puede cualquier paso hacia adelante", () => {
  assert.equal(puedeMover("LISTO", "RECIBIDO", "FOTOGRAFO", R), true);
  assert.equal(puedeMover("ENVIADO", "LISTO", "FOTOGRAFO", R), true);
  assert.equal(puedeMover("ARMADO", "ENVIADO", "FOTOGRAFO", R), true);
  assert.equal(puedeMover("RECIBIDO", "CERRADO", "FOTOGRAFO", R), true);
  assert.equal(puedeMover("LISTO", "ENVIADO", "FOTOGRAFO", R), false);
});

test("puedeMover: nadie sale de CERRADO ni de ANULADO, y no hay movimiento al mismo estado", () => {
  const todos: EstadoLote[] = ["ARMADO", "ENVIADO", "EN_PRODUCCION", "LISTO", "DESPACHADO", "RECIBIDO", "CERRADO", "ANULADO"];
  for (const hacia of todos) {
    for (const quien of ["FOTOGRAFO", "LABORATORIO"] as const) {
      assert.equal(puedeMover("CERRADO", hacia, quien, E), false);
      assert.equal(puedeMover("ANULADO", hacia, quien, E), false);
    }
  }
  assert.equal(puedeMover("LISTO", "LISTO", "FOTOGRAFO", R), false);
});

test("puedeMover: ARMADO→ANULADO sólo el fotógrafo; ANULADO sólo desde ARMADO", () => {
  assert.equal(puedeMover("ARMADO", "ANULADO", "FOTOGRAFO", R), true);
  assert.equal(puedeMover("ARMADO", "ANULADO", "LABORATORIO", R), false);
  assert.equal(puedeMover("ENVIADO", "ANULADO", "FOTOGRAFO", R), false);
});

test("estadoDelPedidoPara", () => {
  assert.equal(estadoDelPedidoPara("EN_PRODUCCION", false), "IN_PRODUCTION");
  assert.equal(estadoDelPedidoPara("LISTO", false), "READY");
  assert.equal(estadoDelPedidoPara("LISTO", true), "READY_TO_PICKUP");
  assert.equal(estadoDelPedidoPara("RECIBIDO", false), "READY_TO_PICKUP");
  assert.equal(estadoDelPedidoPara("RECIBIDO", true), null);
  assert.equal(estadoDelPedidoPara("DESPACHADO", false), null);
  assert.equal(estadoDelPedidoPara("ENVIADO", false), "CREATED");
  assert.equal(estadoDelPedidoPara("ENVIADO", true), "CREATED");
});

test("avisaAlCliente: sólo al entrar a READY_TO_PICKUP", () => {
  assert.equal(avisaAlCliente("READY", "READY_TO_PICKUP"), true);
  assert.equal(avisaAlCliente("READY_TO_PICKUP", "READY_TO_PICKUP"), false);
  assert.equal(avisaAlCliente("CREATED", "READY"), false);
});

test("loteCerrado", () => {
  const sinEntregar = { quitadoAt: null, entregadoAt: null, retiraCliente: true };
  const entregado = { quitadoAt: null, entregadoAt: new Date(), retiraCliente: true };
  const delFotografo = { quitadoAt: null, entregadoAt: null, retiraCliente: false };
  const quitado = { quitadoAt: new Date(), entregadoAt: null, retiraCliente: true };
  assert.equal(loteCerrado([sinEntregar, delFotografo], "LISTO"), false);
  assert.equal(loteCerrado([entregado, delFotografo], "RECIBIDO"), true);
  assert.equal(loteCerrado([entregado, delFotografo], "LISTO"), false);
  assert.equal(loteCerrado([entregado, quitado], "RECIBIDO"), true);
  assert.equal(loteCerrado([sinEntregar, delFotografo], "RECIBIDO"), false);
  // Todos retira cliente: se cierra sin pasar por RECIBIDO.
  assert.equal(loteCerrado([entregado, entregado], "LISTO"), true);
  assert.equal(loteCerrado([entregado, sinEntregar], "LISTO"), false);
  // Mixto: los del fotógrafo se dan por hechos recién al recibir el lote.
  assert.equal(loteCerrado([entregado, delFotografo], "LISTO"), false);
  assert.equal(loteCerrado([entregado, delFotografo], "RECIBIDO"), true);
  // Sin pedidos vigentes, o antes de LISTO, o anulado: no cierra.
  assert.equal(loteCerrado([quitado], "LISTO"), false);
  assert.equal(loteCerrado([], "LISTO"), false);
  assert.equal(loteCerrado([entregado], "EN_PRODUCCION"), false);
  assert.equal(loteCerrado([entregado], "ANULADO"), false);
});

test("motivoParaNoEntrar", () => {
  const ok: PedidoCandidato = { orderStatus: "PAID", esDemo: false, esCanjeVoucher: false, copiasSueltas: 2, enLoteVivo: false };
  assert.equal(motivoParaNoEntrar(ok), null);
  assert.equal(motivoParaNoEntrar({ ...ok, orderStatus: "PENDING" }), "El pedido todavía no está pagado.");
  assert.equal(motivoParaNoEntrar({ ...ok, orderStatus: "PENDING", esDemo: true }), "El pedido todavía no está pagado.");
  assert.equal(motivoParaNoEntrar({ ...ok, esDemo: true }), "Es un pedido de prueba.");
  assert.equal(motivoParaNoEntrar({ ...ok, esCanjeVoucher: true }), "Es un canje: va por Pedidos escolares.");
  assert.equal(motivoParaNoEntrar({ ...ok, copiasSueltas: 0 }), "No tiene copias sueltas para imprimir.");
  assert.equal(motivoParaNoEntrar({ ...ok, enLoteVivo: true }), "Ya está en otro lote.");
});

test("estadoDelPedidoEnElTramo toma el último estado del recorrido", () => {
  // Salto del fotógrafo ENVIADO → RECIBIDO: el que retira el cliente queda listo para retirar.
  assert.equal(estadoDelPedidoEnElTramo("ENVIADO", "RECIBIDO", true), "READY_TO_PICKUP");
  assert.equal(estadoDelPedidoEnElTramo("ENVIADO", "RECIBIDO", false), "READY_TO_PICKUP");
  assert.equal(estadoDelPedidoEnElTramo("ENVIADO", "LISTO", false), "READY");
  assert.equal(estadoDelPedidoEnElTramo("ENVIADO", "EN_PRODUCCION", true), "IN_PRODUCTION");
  assert.equal(estadoDelPedidoEnElTramo("ARMADO", "ENVIADO", true), "CREATED");
  // Mismo estado: se recalcula desde el principio (reparación idempotente).
  assert.equal(estadoDelPedidoEnElTramo("LISTO", "LISTO", false), "READY");
  assert.equal(estadoDelPedidoEnElTramo("LISTO", "LISTO", true), "READY_TO_PICKUP");
  assert.equal(estadoDelPedidoEnElTramo("ARMADO", "ARMADO", true), null);
  assert.equal(estadoDelPedidoEnElTramo("ARMADO", "ANULADO", true), null);
  assert.equal(estadoDelPedidoEnElTramo("ANULADO", "ANULADO", false), null);
});
