import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: B.prisma,
  Prisma: { JsonNull: null, sql: (strings: readonly string[], ...values: unknown[]) => ({ strings, values }) },
}));

const C = await import("./embalaje-config");

beforeEach(() => {
  for (const t of ["product", "fotofficeEmbalaje", "fotofficeProductoEntrega", "fotofficeInsumo"] as const) B.datos[t].length = 0;
  B.agregar("product", { id: "copia", workspaceId: "ws-1", name: "Copia 10x15", kind: "PRODUCTO", isActive: true });
  B.agregar("product", { id: "marco", workspaceId: "ws-1", name: "Portarretratos 20x25", kind: "PRODUCTO", isActive: true });
  B.agregar("product", { id: "viejo", workspaceId: "ws-1", name: "Discontinuado", kind: "PRODUCTO", isActive: false });
  B.agregar("product", { id: "ajeno", workspaceId: "ws-2", name: "De otro", kind: "PRODUCTO", isActive: true });
  B.agregar("product", { id: "kit", workspaceId: "ws-1", name: "Kit", kind: "INSUMO", isActive: true });
});

describe("asegurarEnvoltoriosDeEjemplo", () => {
  it("crea el sobre 19x24 y las tres bolsas una sola vez, con existencia 0 y sin movimientos", async () => {
    expect(await C.asegurarEnvoltoriosDeEjemplo("ws-1")).toEqual({ creados: 4 });
    expect(await C.asegurarEnvoltoriosDeEjemplo("ws-1")).toEqual({ creados: 0 });
    const e = B.datos.fotofficeEmbalaje.filter((x) => x.workspaceId === "ws-1");
    expect(e.map((x) => [x.tipo, Number(x.admiteAnchoCm), Number(x.admiteAltoCm), x.piezasPorUnidad])).toEqual([
      ["SOBRE", 15, 21, 100],
      ["BOLSA", 20, 30, null],
      ["BOLSA", 30, 45, null],
      ["BOLSA", 35, 45, null],
    ]);
    const insumos = B.datos.product.filter((p) => p.kind === "INSUMO" && p.workspaceId === "ws-1" && p.id !== "kit");
    expect(insumos).toHaveLength(4);
    expect(insumos.every((p) => p.stockQty === 0 && p.tracksStock === true)).toBe(true);
    expect(B.datos.stockMovement).toHaveLength(0);
  });
});

describe("guardarEntregas", () => {
  it("guarda la forma de entrega de productos vendibles del negocio", async () => {
    const r = await C.guardarEntregas("ws-1", [
      { productId: "copia", forma: "PIEZA_SUELTA", anchoCm: 10, altoCm: 15, embalajeSiguiente: false, embalajeFijoId: null },
      { productId: "marco", forma: "ENMARCADO", anchoCm: 20, altoCm: 25, embalajeSiguiente: true, embalajeFijoId: null },
    ]);
    expect(r).toEqual({ ok: true, guardadas: 2 });
    expect(B.datos.fotofficeProductoEntrega.map((f) => [f.productId, f.forma])).toEqual([
      ["copia", "PIEZA_SUELTA"],
      ["marco", "ENMARCADO"],
    ]);
  });
  it("rechaza un producto de otro negocio, un insumo y un marco sin medida", async () => {
    const fila = { forma: "PIEZA_SUELTA", anchoCm: 10, altoCm: 15, embalajeSiguiente: false, embalajeFijoId: null };
    expect((await C.guardarEntregas("ws-1", [{ ...fila, productId: "ajeno" }])).ok).toBe(false);
    expect((await C.guardarEntregas("ws-1", [{ ...fila, productId: "kit" }])).ok).toBe(false);
    expect((await C.guardarEntregas("ws-1", [{ ...fila, productId: "marco", forma: "ENMARCADO", anchoCm: null, altoCm: null }])).ok).toBe(false);
    expect(B.datos.fotofficeProductoEntrega).toHaveLength(0);
  });
  it("forma vacía borra la configuración del producto", async () => {
    await C.guardarEntregas("ws-1", [{ productId: "copia", forma: "PIEZA_SUELTA", anchoCm: 10, altoCm: 15, embalajeSiguiente: false, embalajeFijoId: null }]);
    expect(await C.guardarEntregas("ws-1", [{ productId: "copia", forma: null }])).toEqual({ ok: true, guardadas: 1 });
    expect(B.datos.fotofficeProductoEntrega).toHaveLength(0);
  });
});

describe("productosSinEntrega", () => {
  it("cuenta sólo los vendibles activos del negocio sin forma de entrega", async () => {
    expect(await C.productosSinEntrega("ws-1")).toBe(2);
    await C.guardarEntregas("ws-1", [{ productId: "copia", forma: "PIEZA_SUELTA", anchoCm: 10, altoCm: 15, embalajeSiguiente: false, embalajeFijoId: null }]);
    expect(await C.productosSinEntrega("ws-1")).toBe(1);
  });
});

describe("guardarEnvoltorio", () => {
  it("da de alta un envoltorio nuevo con su insumo", async () => {
    const r = await C.guardarEnvoltorio("ws-1", { nombre: "Bolsa 40x50", tipo: "BOLSA", admiteAnchoCm: 40, admiteAltoCm: 50, piezasPorUnidad: null, activo: true });
    expect(r).toEqual({ ok: true });
    const e = B.datos.fotofficeEmbalaje.at(-1)!;
    expect(B.datos.product.find((p) => p.id === e.insumoId)).toMatchObject({ name: "Bolsa 40x50", kind: "INSUMO" });
  });
  it("rechaza medidas imposibles o tipo desconocido", async () => {
    expect((await C.guardarEnvoltorio("ws-1", { nombre: "X", tipo: "CAJA", admiteAnchoCm: 10, admiteAltoCm: 10 })).ok).toBe(false);
    expect((await C.guardarEnvoltorio("ws-1", { nombre: "X", tipo: "BOLSA", admiteAnchoCm: 0, admiteAltoCm: 10 })).ok).toBe(false);
    expect((await C.guardarEnvoltorio("ws-1", { nombre: "", tipo: "BOLSA", admiteAnchoCm: 10, admiteAltoCm: 10 })).ok).toBe(false);
  });
});
