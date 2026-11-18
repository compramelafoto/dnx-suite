import assert from "node:assert/strict";
import { test } from "node:test";

import {
  packDelComprobante,
  packsPendientesDeLaMismaCompra,
  type PedidoPreventaParaEncadenar,
} from "./packs-pendientes-misma-compra";

const base = new Date("2026-11-18T15:00:00.000Z");
const minutos = (m: number) => new Date(base.getTime() + m * 60_000);

function pedido(p: Partial<PedidoPreventaParaEncadenar> & { id: number }): PedidoPreventaParaEncadenar {
  return {
    status: "PENDING",
    totalCents: 20000,
    createdAt: base,
    packDefinitionId: 96,
    packName: "Pack 2",
    ...p,
  };
}

test("pagó el pack 2: le falta el libro que armó en la misma compra", () => {
  const pagado = pedido({ id: 10, status: "PAID", packDefinitionId: 96 });
  const libro = pedido({ id: 11, packDefinitionId: 97, packName: "Libro escolar", totalCents: 25000, createdAt: minutos(0) });
  assert.deepEqual(packsPendientesDeLaMismaCompra(pagado, [pagado, libro]), [
    { orderId: 11, packName: "Libro escolar", totalArs: 25000 },
  ]);
});

test("un pendiente viejo del mismo pack ya pagado no se ofrece (evita pagar dos veces)", () => {
  const viejo = pedido({ id: 5, packDefinitionId: 96, createdAt: minutos(-20) });
  const pagado = pedido({ id: 10, status: "PAID", packDefinitionId: 96 });
  assert.deepEqual(packsPendientesDeLaMismaCompra(pagado, [viejo, pagado]), []);
});

test("un pack pagado en otra compra tampoco se vuelve a ofrecer", () => {
  const libroPagadoAntes = pedido({ id: 3, status: "PAID", packDefinitionId: 97, createdAt: minutos(-600) });
  const pagado = pedido({ id: 10, status: "PAID", packDefinitionId: 96 });
  const libroPendiente = pedido({ id: 11, packDefinitionId: 97 });
  assert.deepEqual(packsPendientesDeLaMismaCompra(pagado, [libroPagadoAntes, pagado, libroPendiente]), []);
});

test("pendientes de hace más de una hora no son de esta compra", () => {
  const pagado = pedido({ id: 10, status: "PAID", packDefinitionId: 96 });
  const lejano = pedido({ id: 4, packDefinitionId: 97, createdAt: minutos(-61) });
  assert.deepEqual(packsPendientesDeLaMismaCompra(pagado, [pagado, lejano]), []);
});

test("reintentos del mismo pack: se ofrece uno solo, el más nuevo", () => {
  const pagado = pedido({ id: 10, status: "PAID", packDefinitionId: 96 });
  const a = pedido({ id: 11, packDefinitionId: 97, createdAt: minutos(1) });
  const b = pedido({ id: 12, packDefinitionId: 97, createdAt: minutos(2) });
  const r = packsPendientesDeLaMismaCompra(pagado, [pagado, a, b]);
  assert.equal(r.length, 1);
  assert.equal(r[0].orderId, 12);
});

test("varios packs pendientes salen en el orden en que se armaron", () => {
  const pagado = pedido({ id: 10, status: "PAID", packDefinitionId: 95 });
  const libro = pedido({ id: 12, packDefinitionId: 97 });
  const pack2 = pedido({ id: 11, packDefinitionId: 96 });
  assert.deepEqual(
    packsPendientesDeLaMismaCompra(pagado, [pagado, libro, pack2]).map((p) => p.orderId),
    [11, 12],
  );
});

test("cancelados y pedidos sin pack no se ofrecen", () => {
  const pagado = pedido({ id: 10, status: "PAID", packDefinitionId: 96 });
  const cancelado = pedido({ id: 11, status: "CANCELED", packDefinitionId: 97 });
  const sinPack = pedido({ id: 12, packDefinitionId: null });
  assert.deepEqual(packsPendientesDeLaMismaCompra(pagado, [pagado, cancelado, sinPack]), []);
});

test("lee el pack del comprobante guardado en el pedido", () => {
  assert.deepEqual(packDelComprobante({ packDefinitionId: 97, packName: "Libro" }), {
    packDefinitionId: 97,
    packName: "Libro",
  });
  assert.deepEqual(packDelComprobante(null), { packDefinitionId: null, packName: null });
  assert.deepEqual(packDelComprobante({ packDefinitionId: "x" }), { packDefinitionId: null, packName: null });
});
