import assert from "node:assert/strict";
import { test } from "node:test";
import {
  avisaAlCliente,
  estadoDelPedidoEnElTramo,
  estadoDelPedidoPara,
  entradaEntregada,
  loteCerrado,
  motivoParaNoEntrar,
  puedeMover,
  vaPorPedidosEscolares,
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

test("loteCerrado: sólo con todos los vigentes entregados, retire quien retire", () => {
  const sinEntregar = { quitadoAt: null, entregadoAt: null };
  const entregado = { quitadoAt: null, entregadoAt: new Date() };
  const quitado = { quitadoAt: new Date(), entregadoAt: null };
  assert.equal(loteCerrado([sinEntregar, sinEntregar], "LISTO"), false);
  // Recibir el lote ya no cierra los que retira el fotógrafo: falta entregarlos.
  assert.equal(loteCerrado([entregado, sinEntregar], "RECIBIDO"), false);
  assert.equal(loteCerrado([entregado, sinEntregar], "LISTO"), false);
  assert.equal(loteCerrado([entregado, entregado], "RECIBIDO"), true);
  assert.equal(loteCerrado([entregado, entregado], "LISTO"), true);
  assert.equal(loteCerrado([entregado, entregado], "DESPACHADO"), true);
  assert.equal(loteCerrado([entregado, quitado], "RECIBIDO"), true);
  // Sin pedidos vigentes, o antes de LISTO, o anulado: no cierra.
  assert.equal(loteCerrado([quitado], "LISTO"), false);
  assert.equal(loteCerrado([], "LISTO"), false);
  assert.equal(loteCerrado([entregado], "ENVIADO"), false);
  assert.equal(loteCerrado([entregado], "EN_PRODUCCION"), false);
  assert.equal(loteCerrado([entregado], "ANULADO"), false);
});

test("loteCerrado: el espejo entregado por la ruta vieja (DELIVERED o RETIRED) cuenta como entregado", () => {
  const porRutaVieja = { quitadoAt: null, entregadoAt: null, estadoPedido: "DELIVERED" };
  const retirado = { quitadoAt: null, entregadoAt: null, estadoPedido: "RETIRED" };
  const listo = { quitadoAt: null, entregadoAt: null, estadoPedido: "READY_TO_PICKUP" };
  assert.equal(loteCerrado([porRutaVieja, retirado], "RECIBIDO"), true);
  assert.equal(loteCerrado([porRutaVieja, listo], "RECIBIDO"), false);
  assert.equal(entradaEntregada({ entregadoAt: null, estadoPedido: "SHIPPED" }), false);
  assert.equal(entradaEntregada({ entregadoAt: new Date(), estadoPedido: "READY" }), true);
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

const COMUN = { origin: "STANDARD_CHECKOUT", redeemsOrderId: null, enLineaEscolar: false };

test("vaPorPedidosEscolares: una compra común va por Impresiones", () => {
  assert.equal(vaPorPedidosEscolares(COMUN), false);
});
test("vaPorPedidosEscolares: un canje de pack va por Pedidos escolares", () => {
  assert.equal(vaPorPedidosEscolares({ ...COMUN, origin: "PACK_REDEMPTION", redeemsOrderId: 10 }), true);
});
test("vaPorPedidosEscolares: una compra común que canjea un pack va por Pedidos escolares", () => {
  assert.equal(vaPorPedidosEscolares({ ...COMUN, redeemsOrderId: 10 }), true);
});
test("vaPorPedidosEscolares: el pack de preventa en sí va por Pedidos escolares aunque traiga copias", () => {
  assert.equal(vaPorPedidosEscolares({ ...COMUN, origin: "PREVENTA_PACK" }), true);
});
test("vaPorPedidosEscolares: con avance de copias escolares va por Pedidos escolares", () => {
  assert.equal(vaPorPedidosEscolares({ ...COMUN, enLineaEscolar: true }), true);
});
test("vaPorPedidosEscolares: un canje sin dato de origen igual va por Pedidos escolares", () => {
  assert.equal(vaPorPedidosEscolares({ origin: null, redeemsOrderId: 7, enLineaEscolar: false }), true);
});
