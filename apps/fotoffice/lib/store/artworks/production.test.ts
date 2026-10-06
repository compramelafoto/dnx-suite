import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Producción de obras (spec O12): qué se muestra por renglón y quién puede bajar el original.
 * Firmar el enlace es autorizar (FotoRank no revisa nada), así que las guardas de acá son
 * la única barrera.
 */
const h = vi.hoisted(() => ({
  prisma: {
    storeOrder: { findFirst: vi.fn() },
    storeOrderItem: { findFirst: vi.fn() },
  },
  buildOriginalUrl: vi.fn(),
}));
vi.mock("@repo/db", () => ({ prisma: h.prisma }));
vi.mock("./fotorank-client", () => {
  class ArtworkImageError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { buildOriginalUrl: h.buildOriginalUrl, ArtworkImageError };
});

const { artworkProductionInfo, resolveOriginalDownload, canDownloadOriginal } = await import("./production");
const { ArtworkImageError } = await import("./fotorank-client");

describe("artworkProductionInfo", () => {
  it("muestra medidas, píxeles del original y si lleva bordes", () => {
    const info = artworkProductionInfo({
      printFormatName: "Copia",
      printFormat: { name: "Copia", widthCm: 30, heightCm: 45 },
      artworkListing: { originalWidth: 4000, originalHeight: 6000 },
    });
    expect(info).toEqual({
      formatLabel: "Copia",
      sizeLabel: "30 × 45 cm",
      pixelsLabel: "4000 × 6000 px",
      borders: false,
    });
  });

  it("avisa bordes cuando la proporción no coincide", () => {
    const info = artworkProductionInfo({
      printFormatName: "Cuadro",
      printFormat: { name: "Cuadro", widthCm: 30, heightCm: 30 },
      artworkListing: { originalWidth: 4000, originalHeight: 6000 },
    });
    expect(info?.borders).toBe(true);
  });

  it("si el formato o la ficha ya no existen, muestra lo congelado sin inventar", () => {
    const info = artworkProductionInfo({
      printFormatName: "Copia vieja",
      printFormat: null,
      artworkListing: null,
    });
    expect(info).toEqual({ formatLabel: "Copia vieja", sizeLabel: null, pixelsLabel: null, borders: false });
  });

  it("un renglón de producto no es de obra", () => {
    expect(artworkProductionInfo({ printFormatName: null, printFormat: null, artworkListing: null })).toBeNull();
  });
});

describe("canDownloadOriginal", () => {
  it("sólo con la plata adentro y el pedido vivo", () => {
    for (const s of ["PAID", "READY", "SHIPPED", "DELIVERED"] as const) expect(canDownloadOriginal(s)).toBe(true);
    for (const s of ["PENDING_PAYMENT", "CANCELLED", "EXPIRED", "PAID_NO_STOCK"] as const) {
      expect(canDownloadOriginal(s)).toBe(false);
    }
  });
});

describe("resolveOriginalDownload", () => {
  beforeEach(() => {
    h.prisma.storeOrder.findFirst.mockReset();
    h.prisma.storeOrderItem.findFirst.mockReset();
    h.buildOriginalUrl.mockReset();
    h.buildOriginalUrl.mockReturnValue("https://fotorank.test/firmado");
  });

  const input = { workspaceId: "ws1", orderId: "ord1", itemId: "it1" };

  it("firma el original de una obra de un pedido pagado del workspace", async () => {
    h.prisma.storeOrder.findFirst.mockResolvedValue({ id: "ord1", status: "READY" });
    h.prisma.storeOrderItem.findFirst.mockResolvedValue({
      artworkListingId: "lst1",
      artworkListing: { entryId: "entry1", workspaceId: "ws1" },
    });
    const r = await resolveOriginalDownload(input);
    expect(r).toEqual({ ok: true, url: "https://fotorank.test/firmado" });
    expect(h.prisma.storeOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ord1", workspaceId: "ws1" } }),
    );
    expect(h.prisma.storeOrderItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "it1", orderId: "ord1" } }),
    );
    expect(h.buildOriginalUrl).toHaveBeenCalledWith("entry1");
  });

  it("un pedido de otro workspace no existe", async () => {
    h.prisma.storeOrder.findFirst.mockResolvedValue(null);
    const r = await resolveOriginalDownload(input);
    expect(r.ok).toBe(false);
    expect(h.prisma.storeOrderItem.findFirst).not.toHaveBeenCalled();
    expect(h.buildOriginalUrl).not.toHaveBeenCalled();
  });

  it.each(["PENDING_PAYMENT", "CANCELLED", "EXPIRED", "PAID_NO_STOCK"])("con el pedido %s no se firma", async (status) => {
    h.prisma.storeOrder.findFirst.mockResolvedValue({ id: "ord1", status });
    const r = await resolveOriginalDownload(input);
    expect(r.ok).toBe(false);
    expect(h.buildOriginalUrl).not.toHaveBeenCalled();
  });

  it("un renglón que no es del pedido no se firma", async () => {
    h.prisma.storeOrder.findFirst.mockResolvedValue({ id: "ord1", status: "PAID" });
    h.prisma.storeOrderItem.findFirst.mockResolvedValue(null);
    const r = await resolveOriginalDownload(input);
    expect(r.ok).toBe(false);
    expect(h.buildOriginalUrl).not.toHaveBeenCalled();
  });

  it("un renglón de producto (sin obra) no se firma", async () => {
    h.prisma.storeOrder.findFirst.mockResolvedValue({ id: "ord1", status: "PAID" });
    h.prisma.storeOrderItem.findFirst.mockResolvedValue({ artworkListingId: null, artworkListing: null });
    const r = await resolveOriginalDownload(input);
    expect(r.ok).toBe(false);
    expect(h.buildOriginalUrl).not.toHaveBeenCalled();
  });

  it("una ficha de otro workspace no se firma", async () => {
    h.prisma.storeOrder.findFirst.mockResolvedValue({ id: "ord1", status: "PAID" });
    h.prisma.storeOrderItem.findFirst.mockResolvedValue({
      artworkListingId: "lst1",
      artworkListing: { entryId: "entry1", workspaceId: "otro" },
    });
    const r = await resolveOriginalDownload(input);
    expect(r.ok).toBe(false);
    expect(h.buildOriginalUrl).not.toHaveBeenCalled();
  });

  it("sin el secreto avisa que las obras no están configuradas", async () => {
    h.prisma.storeOrder.findFirst.mockResolvedValue({ id: "ord1", status: "PAID" });
    h.prisma.storeOrderItem.findFirst.mockResolvedValue({
      artworkListingId: "lst1",
      artworkListing: { entryId: "entry1", workspaceId: "ws1" },
    });
    h.buildOriginalUrl.mockImplementation(() => {
      throw new ArtworkImageError("ARTWORKS_NOT_CONFIGURED");
    });
    const r = await resolveOriginalDownload(input);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("configur") });
  });
});
