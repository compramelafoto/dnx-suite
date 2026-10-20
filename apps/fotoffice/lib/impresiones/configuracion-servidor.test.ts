import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficePrintSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  fotofficePrintSize: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  fotofficeProveedor: { findMany: vi.fn() },
  workspaceFeatureModule: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn(async () => true) }));
const C = await import("./configuracion-servidor");

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
});

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
  const fila = (o: object = {}) => ({ id: "a", costArs: "100", priceArs: "1.500,50", proveedorId: null, active: true, ...o });
  it("rechaza precios negativos", async () => {
    expect((await C.guardarTamanos("ws", [fila({ costArs: "-1" })])).ok).toBe(false);
  });
  it("rechaza un laboratorio de otro estudio", async () => {
    db.fotofficeProveedor.findMany.mockResolvedValue([]);
    const r = await C.guardarTamanos("ws", [fila({ proveedorId: "ajeno" })]);
    expect(r).toEqual({ ok: false, error: "Uno de los laboratorios no es de tu estudio." });
    expect(db.fotofficeProveedor.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["ajeno"] }, workspaceId: "ws" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("guarda todo dentro de una transacción, acotado al estudio", async () => {
    db.fotofficeProveedor.findMany.mockResolvedValue([{ id: "p" }]);
    db.fotofficePrintSize.updateMany.mockResolvedValue({ count: 1 });
    const r = await C.guardarTamanos("ws", [fila({ proveedorId: "p" }), fila({ id: "b" })]);
    expect(r).toEqual({ ok: true });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.fotofficePrintSize.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "a", workspaceId: "ws" }, data: { priceArs: 1500.5, costArs: 100, proveedorId: "p" } });
  });
  it("si un tamaño no existe o es ajeno, falla todo", async () => {
    db.fotofficePrintSize.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const r = await C.guardarTamanos("ws", [fila(), fila({ id: "ajeno" })]);
    expect(r).toEqual({ ok: false, error: "Uno de los tamaños ya no existe. Recargá la página." });
  });
});

describe("leerAjustes", () => {
  it("devuelve los montos en formato es-AR que el guardado entiende", async () => {
    db.fotofficePrintSize.count.mockResolvedValue(1);
    db.fotofficePrintSettings.findUnique.mockResolvedValue(null);
    db.fotofficePrintSize.findMany.mockResolvedValue([
      { id: "a", widthCm: 10, heightCm: 15, proveedorId: null, proveedor: null, costArs: { toString: () => "1500.5" }, priceArs: null, active: true },
    ]);
    const a = await C.leerAjustes("ws");
    expect(a.tamanos[0].costArs).toBe("1500,50");
    expect(a.tamanos[0].priceArs).toBe("");
  });
});
