import { describe, expect, it } from "vitest";
import {
  albumPackDraftStorageKey,
  albumPackGuestTokenStorageKey,
  clearAlbumPackCartForPaidOrder,
  readStoredAlbumPackCartOrderId,
} from "./album-pack-cart-storage";

function memoryStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

describe("album-pack-cart-storage", () => {
  it("lee el orderId guardado en el carrito", () => {
    expect(readStoredAlbumPackCartOrderId(JSON.stringify({ items: [], orderId: 4645 }))).toBe(4645);
    expect(readStoredAlbumPackCartOrderId(JSON.stringify({ items: [], orderId: null }))).toBeNull();
    expect(readStoredAlbumPackCartOrderId("no-json")).toBeNull();
    expect(readStoredAlbumPackCartOrderId(null)).toBeNull();
  });

  it("después del pago limpia el carrito y el token si son de ese pedido", () => {
    const storage = memoryStorage({
      [albumPackDraftStorageKey(10)]: JSON.stringify({ items: [{ draftId: "d1" }], orderId: 4645 }),
      [albumPackGuestTokenStorageKey(10)]: "guest-1",
    });
    expect(clearAlbumPackCartForPaidOrder(storage, 10, 4645)).toBe(true);
    expect(storage.data.size).toBe(0);
  });

  it("no toca un carrito de otro pedido (o todavía sin pedido)", () => {
    const storage = memoryStorage({
      [albumPackDraftStorageKey(10)]: JSON.stringify({ items: [{ draftId: "d2" }], orderId: null }),
      [albumPackGuestTokenStorageKey(10)]: "guest-1",
    });
    expect(clearAlbumPackCartForPaidOrder(storage, 10, 4645)).toBe(false);
    expect(storage.data.size).toBe(2);
  });
});
