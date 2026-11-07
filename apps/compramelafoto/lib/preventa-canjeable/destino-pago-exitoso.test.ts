import assert from "node:assert/strict";
import { test } from "node:test";

import { destinoTrasPagoDePreventa, rutaDelPackConCodigo } from "./destino-pago-exitoso";

test("con enlace del pack, la familia va a su pack con código (sin sesión)", () => {
  assert.equal(
    destinoTrasPagoDePreventa({
      packAccessUrl: "/cliente/pack/AbC_def-1234567890xyz",
      preventaUxV2: true,
      orderId: "5974",
      selfiesOrderId: 669,
    }),
    "/cliente/pack/AbC_def-1234567890xyz",
  );
});

test("sin enlace, sigue el camino de siempre", () => {
  assert.equal(
    destinoTrasPagoDePreventa({ packAccessUrl: null, preventaUxV2: true, orderId: "5974", selfiesOrderId: 669 }),
    "/cliente/pack/5974",
  );
  assert.equal(
    destinoTrasPagoDePreventa({ packAccessUrl: undefined, preventaUxV2: false, orderId: "5974", selfiesOrderId: 669 }),
    "/order/669/selfies",
  );
});

test("un enlace raro o hacia otro sitio no se usa", () => {
  for (const malo of ["https://otro.com/cliente/pack/x", "//otro.com", "/cliente/pack/", "/admin", 123]) {
    assert.equal(
      destinoTrasPagoDePreventa({ packAccessUrl: malo, preventaUxV2: true, orderId: "1", selfiesOrderId: 2 }),
      "/cliente/pack/1",
    );
  }
});

test("la ruta con código escapa caracteres", () => {
  assert.equal(rutaDelPackConCodigo("a b"), "/cliente/pack/a%20b");
});
