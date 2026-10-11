import { describe, expect, it } from "vitest";
import {
  ALBUM_PACK_ORDER_ALREADY_PAID_CODE,
  ALBUM_PACK_ORDER_NOT_PAYABLE_CODE,
  checkAlbumPackOrderPayable,
  isAlbumPackDraftOrderConsumed,
} from "./album-pack-order-payable";

describe("checkAlbumPackOrderPayable", () => {
  it("deja pagar sólo un pedido PENDING", () => {
    expect(checkAlbumPackOrderPayable("PENDING")).toEqual({ ok: true });
  });

  it("un pedido PAID devuelve ORDER_ALREADY_PAID (409), nunca un link", () => {
    const res = checkAlbumPackOrderPayable("PAID");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe(ALBUM_PACK_ORDER_ALREADY_PAID_CODE);
      expect(res.httpStatus).toBe(409);
      expect(res.error).toMatch(/ya está pagado/);
    }
  });

  it.each(["FAILED", "CANCELED", "REFUNDED", null, undefined])(
    "%s no es pagable (ORDER_NOT_PAYABLE)",
    (status) => {
      const res = checkAlbumPackOrderPayable(status as string | null | undefined);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe(ALBUM_PACK_ORDER_NOT_PAYABLE_CODE);
    }
  );
});

describe("isAlbumPackDraftOrderConsumed", () => {
  it("sólo un pedido PAID consume el borrador", () => {
    expect(isAlbumPackDraftOrderConsumed("PAID")).toBe(true);
    expect(isAlbumPackDraftOrderConsumed("PENDING")).toBe(false);
    expect(isAlbumPackDraftOrderConsumed("FAILED")).toBe(false);
  });
});
