import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ album: vi.fn(), order: vi.fn(), orders: vi.fn(), token: vi.fn(), settings: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findFirst: (...a: unknown[]) => m.album(...a) },
    order: { findFirst: (...a: unknown[]) => m.order(...a), findMany: (...a: unknown[]) => m.orders(...a) },
    orderDownloadToken: { findFirst: (...a: unknown[]) => m.token(...a) },
    systemSettings: { findUnique: (...a: unknown[]) => m.settings(...a) },
  },
}));
vi.mock("@/lib/mercadopago/mp-connection-health", () => ({
  getMercadoPagoConnectionHealth: async () => ({ status: "EXPIRED", selfHealed: false }),
  needsMercadoPagoReconnect: (s: string) => s === "EXPIRED",
}));
import { lecturaTools } from "./lectura";

const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" };
const tool = (n: string) => lecturaTools.find((t) => t.name === n)!;
beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe("herramientas de lectura", () => {
  it("ver_album filtra por dueño: álbum ajeno = no encontrado", async () => {
    m.album.mockResolvedValue(null);
    const r = await tool("ver_album").run({ albumId: 99 }, actor);
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(m.album.mock.calls[0]![0].where).toMatchObject({ id: 99, userId: 7, deletedAt: null });
  });
  it("ver_album devuelve datos serializables con precios en pesos", async () => {
    m.album.mockResolvedValue({
      id: 3, title: "Boda", isPublic: true, location: null, eventDate: null, expiresAt: new Date(),
      enableDigitalPhotos: true, enablePrintedPhotos: false, digitalPhotoPriceCents: 2990,
      digitalDiscount5Plus: null, digitalDiscount10Plus: null, digitalDiscount20Plus: null,
      termsAcceptedAt: null, termsVersion: null, albumProfitMarginPercent: null, selectedLabId: null,
      pickupBy: null, printPricingSource: "PHOTOGRAPHER", hiddenPhotosEnabled: false, hiddenSelfieRetentionDays: null,
      packs: [{ id: "p1", name: "Pack", price: 5000, isActive: true, includedPhotoCount: 3 }],
      _count: { photos: 12 },
    });
    const r = await tool("ver_album").run({ albumId: 3 }, actor);
    expect(r).toMatchObject({ ok: true });
    expect(() => JSON.stringify(r)).not.toThrow();
    expect(JSON.stringify(r)).toContain("2.990");
  });
  it("buscar_pedidos filtra por dueño del álbum", async () => {
    m.orders.mockResolvedValue([{ id: 1, status: "PAID", totalCents: 1000, createdAt: new Date(), albumId: 3 }]);
    const r = await tool("buscar_pedidos").run({}, actor);
    expect(r).toMatchObject({ ok: true });
    expect(m.orders.mock.calls[0]![0].where).toMatchObject({ album: { userId: 7 } });
  });
  it("ver_pedido filtra por dueño del álbum y oculta datos del comprador si no está pagado", async () => {
    m.order.mockResolvedValue({ id: 5, status: "PENDING", totalCents: 5980, buyerEmail: "c@x.com", createdAt: new Date(), items: [], digitalDeliveredAt: null });
    m.token.mockResolvedValue(null);
    const r = await tool("ver_pedido").run({ orderId: 5 }, actor);
    expect(m.order.mock.calls[0]![0].where).toMatchObject({ id: 5, album: { userId: 7 } });
    expect(JSON.stringify(r)).not.toContain("c@x.com");
    expect(JSON.stringify(r)).toContain("5.980");
  });
  it("ver_pedido ajeno = no encontrado", async () => {
    m.order.mockResolvedValue(null);
    expect(await tool("ver_pedido").run({ orderId: 8 }, actor)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
  it("estado_mercadopago avisa que hay que reconectar", async () => {
    const r = await tool("estado_mercadopago").run({}, actor);
    expect(r).toMatchObject({ ok: true });
    expect((r as { message: string }).message).toContain("reconect");
  });
  it("ver_tutoriales lista los videos", async () => {
    m.settings.mockResolvedValue({ value: JSON.stringify([{ title: "Subir fotos", youtubeUrl: "https://youtu.be/abc" }]) });
    const r = await tool("ver_tutoriales").run({}, actor);
    expect(JSON.stringify(r)).toContain("Subir fotos");
  });
});
