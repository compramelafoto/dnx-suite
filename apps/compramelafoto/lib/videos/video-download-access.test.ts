import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { canDownloadPurchasedVideo } from "./video-download-access";

const base = {
  orderStatus: "PAID",
  tokenOrderId: 10,
  orderId: 10,
  boughtVideoIds: [21, 22],
  requestedVideoId: 21,
  videoPurged: false,
};

describe("canDownloadPurchasedVideo", () => {
  it("deja bajar un video pagado del propio pedido", () => {
    assert.equal(canDownloadPurchasedVideo(base).allowed, true);
  });

  it("no deja bajar si el pedido todavía no está pagado", () => {
    const r = canDownloadPurchasedVideo({ ...base, orderStatus: "PENDING" });
    assert.equal(r.allowed, false);
    assert.match(r.reason!, /pago/i);
  });

  it("no deja bajar un pedido devuelto", () => {
    assert.equal(
      canDownloadPurchasedVideo({ ...base, orderStatus: "REFUNDED" }).allowed,
      false
    );
  });

  it("no deja usar el token de un pedido para bajar el video de otro", () => {
    // Sin este control, alguien con un link válido podría pedir cualquier id.
    const r = canDownloadPurchasedVideo({ ...base, requestedVideoId: 99 });
    assert.equal(r.allowed, false);
    assert.match(r.reason!, /no (está|forma)/i);
  });

  it("no deja que un token de otro pedido sirva para este", () => {
    const r = canDownloadPurchasedVideo({ ...base, tokenOrderId: 11 });
    assert.equal(r.allowed, false);
  });

  it("avisa con claridad cuando el archivo ya se borró por los 15 días", () => {
    const r = canDownloadPurchasedVideo({ ...base, videoPurged: true });
    assert.equal(r.allowed, false);
    assert.match(r.reason!, /15 días|ya no está/i);
  });

  it("un token sin pedido asociado no sirve", () => {
    assert.equal(
      canDownloadPurchasedVideo({ ...base, tokenOrderId: null }).allowed,
      false
    );
  });

  it("un pedido sin videos comprados no habilita nada", () => {
    assert.equal(
      canDownloadPurchasedVideo({ ...base, boughtVideoIds: [] }).allowed,
      false
    );
  });
});
