import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAlbumOrderPrintOrderMirror } from "./create-album-order-print-order-mirror";

describe("createAlbumOrderPrintOrderMirror", () => {
  it("crea PrintOrder con tag ALBUM_ORDER y 4 ítems", async () => {
    const createdItems: unknown[] = [];
    let createdOrder: Record<string, unknown> | null = null;

    const tx = {
      printOrder: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdOrder = data;
          createdItems.push(...((data.items as { create: unknown[] }).create ?? []));
          return { id: 501 };
        },
      },
    };

    const result = await createAlbumOrderPrintOrderMirror(tx as never, {
      albumOrderId: 42,
      photographerId: 7,
      customerEmail: "buyer@test.com",
      customerName: "Buyer",
      printItems: [
        {
          fileKey: "a/1.jpg",
          size: "10x15",
          acabado: "BRILLO",
          quantity: 1,
          unitPrice: 2500,
          subtotal: 2500,
        },
        {
          fileKey: "a/2.jpg",
          size: "10x15",
          acabado: "BRILLO",
          quantity: 1,
          unitPrice: 2500,
          subtotal: 2500,
        },
        {
          fileKey: "a/3.jpg",
          size: "10x15",
          acabado: "BRILLO",
          quantity: 1,
          unitPrice: 2500,
          subtotal: 2500,
        },
        {
          fileKey: "a/4.jpg",
          size: "10x15",
          acabado: "BRILLO",
          quantity: 1,
          unitPrice: 2500,
          subtotal: 2500,
        },
      ],
    });

    assert.equal(result?.printOrderId, 501);
    assert.ok(createdOrder);
    assert.deepEqual((createdOrder as { tags: string[] }).tags, ["ALBUM_ORDER:42"]);
    assert.equal((createdOrder as { total: number }).total, 10_000);
    assert.equal(createdItems.length, 4);
  });

  it("idempotente si ya existe tag", async () => {
    const tx = {
      printOrder: {
        findFirst: async () => ({ id: 999 }),
        create: async () => {
          throw new Error("should not create");
        },
      },
    };

    const result = await createAlbumOrderPrintOrderMirror(tx as never, {
      albumOrderId: 1,
      photographerId: 1,
      customerEmail: "a@b.com",
      printItems: [
        {
          fileKey: "x.jpg",
          size: "10x15",
          acabado: "BRILLO",
          quantity: 1,
          unitPrice: 100,
          subtotal: 100,
        },
      ],
    });

    assert.equal(result?.printOrderId, 999);
  });
});
