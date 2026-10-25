import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  product: { findMany: vi.fn(), findFirst: vi.fn() },
  fotofficeProveedor: { findFirst: vi.fn() },
  fotofficeAliasProveedor: { findMany: vi.fn(), upsert: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));

const { indiceParaAsociar, guardarAlias } = await import("./alias-servidor");

beforeEach(() => {
  vi.clearAllMocks();
  db.product.findMany.mockResolvedValue([
    { id: "p1", name: "Papel", barcode: "779 1234", sku: "AB-1" },
    { id: "p2", name: "Tinta", barcode: null, sku: null },
  ]);
  db.product.findFirst.mockResolvedValue({ id: "p1" });
  db.fotofficeProveedor.findFirst.mockResolvedValue({ id: "pr" });
  db.fotofficeAliasProveedor.findMany.mockResolvedValue([{ textoNormalizado: "papel x", productId: "p1" }]);
});

describe("indiceParaAsociar", () => {
  it("arma los índices con el negocio y el proveedor", async () => {
    const i = await indiceParaAsociar("w", "pr");
    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "w", isActive: true }, orderBy: { createdAt: "asc" } }));
    expect(db.fotofficeAliasProveedor.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "w", proveedorId: "pr", product: { isActive: true, workspaceId: "w" } } }));
    expect(i.porBarcode.get("7791234")).toBe("p1");
    expect(i.porSku.get("ab-1")).toBe("p1");
    expect(i.porAlias.get("papel x")).toBe("p1");
    expect(i.catalogo).toEqual([{ id: "p1", nombre: "Papel" }, { id: "p2", nombre: "Tinta" }]);
  });
  it("sin proveedor no consulta alias", async () => {
    const i = await indiceParaAsociar("w", null);
    expect(db.fotofficeAliasProveedor.findMany).not.toHaveBeenCalled();
    expect(i.porAlias.size).toBe(0);
  });
});

describe("guardarAlias", () => {
  it("upsert por proveedor y texto normalizado", async () => {
    expect(await guardarAlias(db as never, { workspaceId: "w", proveedorId: "pr", descripcion: "Papel, X!", productId: "p1" })).toBe(true);
    expect(db.fotofficeAliasProveedor.upsert).toHaveBeenCalledWith({
      where: { proveedorId_textoNormalizado: { proveedorId: "pr", textoNormalizado: "papel x" } },
      create: { workspaceId: "w", proveedorId: "pr", textoNormalizado: "papel x", productId: "p1" },
      update: { productId: "p1" },
    });
  });
  it("no hace nada con texto vacío", async () => {
    await guardarAlias(db as never, { workspaceId: "w", proveedorId: "pr", descripcion: " .. ", productId: "p1" });
    expect(db.fotofficeAliasProveedor.upsert).not.toHaveBeenCalled();
  });
  it("no guarda con proveedor de otro negocio", async () => {
    db.fotofficeProveedor.findFirst.mockResolvedValue(null);
    expect(await guardarAlias(db as never, { workspaceId: "w", proveedorId: "x", descripcion: "papel", productId: "p1" })).toBe(false);
    expect(db.fotofficeAliasProveedor.upsert).not.toHaveBeenCalled();
  });
  it("no guarda con producto de otro negocio o inactivo", async () => {
    db.product.findFirst.mockResolvedValue(null);
    expect(await guardarAlias(db as never, { workspaceId: "w", proveedorId: "pr", descripcion: "papel", productId: "x" })).toBe(false);
    expect(db.fotofficeAliasProveedor.upsert).not.toHaveBeenCalled();
  });
});
