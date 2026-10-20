import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficePrintSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  fotofficePrintSize: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn(), update: vi.fn() },
  fotofficeProveedor: { findMany: vi.fn() },
  workspaceFeatureModule: { findUnique: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn(async () => true) }));
const C = await import("./configuracion-servidor");

beforeEach(() => vi.clearAllMocks());

describe("ofertaPublica", () => {
  it("sólo ofrece tamaños activos con precio", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: false });
    db.fotofficePrintSize.findMany.mockResolvedValue([
      { id: "a", widthCm: 10, heightCm: 15, proveedorId: "f", priceArs: "500", costArs: "200", active: true },
      { id: "b", widthCm: 13, heightCm: 18, proveedorId: "f", priceArs: null, costArs: "300", active: true },
    ]);
    const o = await C.ofertaPublica("ws");
    expect(o?.papeles).toEqual(["BRILLO"]);
    expect(o?.tamanos.map((t) => t.id)).toEqual(["a"]);
    expect(o?.tamanos[0].priceCents).toBe(50000);
  });
  it("sin tamaños con precio no hay oferta", async () => {
    db.fotofficePrintSettings.findUnique.mockResolvedValue({ paperGlossy: true, paperMatte: true });
    db.fotofficePrintSize.findMany.mockResolvedValue([]);
    expect(await C.ofertaPublica("ws")).toBeNull();
  });
});

describe("sembrarTamanos", () => {
  it("no siembra dos veces", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(3);
    await C.sembrarTamanos("ws");
    expect(db.fotofficePrintSize.createMany).not.toHaveBeenCalled();
  });
  it("asigna Fotolag y La Isla por nombre", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(0);
    db.fotofficeProveedor.findMany.mockResolvedValue([{ id: "f", name: "Fotolag" }, { id: "i", name: "La Isla" }]);
    await C.sembrarTamanos("ws");
    const data = db.fotofficePrintSize.createMany.mock.calls[0][0].data;
    expect(data.find((d: { widthCm: number }) => d.widthCm === 20)?.proveedorId).toBe("f");
    expect(data.find((d: { widthCm: number }) => d.widthCm === 50)?.proveedorId).toBe("i");
  });
});

describe("guardarTamanos", () => {
  it("rechaza precios negativos", async () => {
    expect((await C.guardarTamanos("ws", [{ id: "a", costArs: "-1", priceArs: "100", proveedorId: null, active: true }])).ok).toBe(false);
  });
});
