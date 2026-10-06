import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  appendPreventaRedeemParams,
  buildPreventaRedeemGalleryUrl,
  readPreventaRedeemParams,
} from "./preventa-redeem-url";

describe("buildPreventaRedeemGalleryUrl", () => {
  it("lleva a la galería, no a la compra: la compra sin fotos cortaba con error", () => {
    const url = buildPreventaRedeemGalleryUrl({ albumId: 959, preventaPackToken: "abc" });
    assert.equal(url, "/a/959?preventaPackToken=abc");
    assert.ok(!url.includes("/comprar"));
  });

  it("acepta el número de pedido cuando la familia entra logueada", () => {
    assert.equal(
      buildPreventaRedeemGalleryUrl({ albumId: 959, preventaPackOrderId: 3196 }),
      "/a/959?preventaPackOrderId=3196"
    );
  });

  it("sin pack es la galería común", () => {
    assert.equal(buildPreventaRedeemGalleryUrl({ albumId: 959 }), "/a/959");
  });
});

describe("readPreventaRedeemParams", () => {
  it("lee el token del link", () => {
    assert.deepEqual(readPreventaRedeemParams(new URLSearchParams("preventaPackToken=abc")), {
      preventaPackToken: "abc",
    });
  });

  it("ignora un número de pedido inválido", () => {
    assert.equal(readPreventaRedeemParams(new URLSearchParams("preventaPackOrderId=xx")), null);
  });

  it("sin parámetros no hay canje", () => {
    assert.equal(readPreventaRedeemParams(new URLSearchParams("photoIds=1,2")), null);
  });

  it("ida y vuelta: lo que se lee se puede volver a agregar a la compra", () => {
    const ctx = readPreventaRedeemParams(
      new URLSearchParams("preventaPackToken=abc&preventaPackOrderId=7")
    );
    const params = new URLSearchParams("photoIds=1,2");
    appendPreventaRedeemParams(params, ctx);
    assert.equal(params.get("preventaPackToken"), "abc");
    assert.equal(params.get("preventaPackOrderId"), "7");
    assert.equal(params.get("photoIds"), "1,2");
  });
});
