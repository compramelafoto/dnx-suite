import assert from "node:assert/strict";
import { test } from "node:test";
import { isPantallaPedidosPath } from "./pantalla-pedidos-path";

test("la pantalla de pedidos va sin menú lateral", () => {
  assert.equal(isPantallaPedidosPath("/fotografo/escuelas/pedidos/pantalla"), true);
  assert.equal(isPantallaPedidosPath("/fotografo/escuelas/pedidos/pantalla/"), true);
});

test("Pedidos escolares y el resto del panel siguen con menú", () => {
  assert.equal(isPantallaPedidosPath("/fotografo/escuelas/pedidos"), false);
  assert.equal(isPantallaPedidosPath("/fotografo/escuelas/pedidos/pantallazo"), false);
  assert.equal(isPantallaPedidosPath(null), false);
});
