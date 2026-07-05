import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CheckoutPaymentSource, OrderOrigin, OrderStatus } from "@/lib/prisma";
import {
  albumOrderCanRetryPayment,
  buildAlbumOrderFailureBackUrl,
  buyerCanAccessAlbumOrder,
  isAlbumOrderRecoveryScope,
} from "./album-order-payment-recovery";

describe("album-order-payment-recovery", () => {
  const baseOrder = {
    status: OrderStatus.PENDING,
    isTest: false,
    checkoutPaymentSource: CheckoutPaymentSource.MERCADO_PAGO,
    origin: OrderOrigin.STANDARD_CHECKOUT,
  };

  it("scope accepts only ALBUM_ORDER", () => {
    assert.equal(isAlbumOrderRecoveryScope("ALBUM_ORDER"), true);
    assert.equal(isAlbumOrderRecoveryScope("PRINT_ORDER"), false);
    assert.equal(isAlbumOrderRecoveryScope("PRECOMPRA_ORDER"), false);
    assert.equal(isAlbumOrderRecoveryScope("DNX_COURSE_ENROLLMENT"), false);
  });

  it("canRetry true for PENDING and FAILED album orders", () => {
    assert.equal(albumOrderCanRetryPayment({ ...baseOrder, status: OrderStatus.PENDING }), true);
    assert.equal(albumOrderCanRetryPayment({ ...baseOrder, status: OrderStatus.FAILED }), true);
  });

  it("canRetry false for PAID and unsupported origins", () => {
    assert.equal(albumOrderCanRetryPayment({ ...baseOrder, status: OrderStatus.PAID }), false);
    assert.equal(
      albumOrderCanRetryPayment({ ...baseOrder, origin: OrderOrigin.PACK_REDEMPTION }),
      false
    );
    assert.equal(albumOrderCanRetryPayment({ ...baseOrder, isTest: true }), false);
    assert.equal(
      albumOrderCanRetryPayment({
        ...baseOrder,
        checkoutPaymentSource: CheckoutPaymentSource.SIMULATED,
      }),
      false
    );
  });

  it("backUrl routes standard checkout to album gallery", () => {
    assert.equal(
      buildAlbumOrderFailureBackUrl(OrderOrigin.STANDARD_CHECKOUT, "mi-album"),
      "/a/mi-album"
    );
  });

  it("backUrl routes preventa pack to preventa page", () => {
    assert.equal(
      buildAlbumOrderFailureBackUrl(OrderOrigin.PREVENTA_PACK, "colegio-2025"),
      "/album/colegio-2025/preventa"
    );
  });

  it("guest without email cannot access order", () => {
    assert.equal(
      buyerCanAccessAlbumOrder(
        { buyerUserId: null, buyerEmail: "buyer@example.com" },
        null,
        undefined
      ),
      false
    );
  });

  it("guest with wrong email cannot access order", () => {
    assert.equal(
      buyerCanAccessAlbumOrder(
        { buyerUserId: null, buyerEmail: "buyer@example.com" },
        null,
        "other@example.com"
      ),
      false
    );
  });

  it("guest with correct email can access order", () => {
    assert.equal(
      buyerCanAccessAlbumOrder(
        { buyerUserId: null, buyerEmail: "buyer@example.com" },
        null,
        "Buyer@Example.com"
      ),
      true
    );
  });
});
