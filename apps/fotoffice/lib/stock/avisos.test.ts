import { describe, expect, it } from "vitest";
import {
  consumoDiario,
  diasDeCobertura,
  listaPorProveedor,
  paraComprar,
  textoCobertura,
  type ItemStock,
} from "./avisos";

const item = (o: Partial<ItemStock> & { productId: string }): ItemStock => ({
  nombre: o.productId,
  stockQty: 100,
  minStockQty: null,
  tracksStock: true,
  unidad: "unidades",
  proveedor: null,
  unidadCompra: null,
  unidadesPorCompra: null,
  consumo30: 0,
  ...o,
});

describe("cobertura", () => {
  it("consumo diario", () => {
    expect(consumoDiario(300)).toBe(10);
    expect(consumoDiario(-5)).toBe(0);
  });
  it("días", () => {
    expect(diasDeCobertura(95, 10)).toBe(9);
    expect(diasDeCobertura(0, 10)).toBe(0);
    expect(diasDeCobertura(-3, 0)).toBe(0);
    expect(diasDeCobertura(50, 0)).toBeNull();
  });
  it("textos", () => {
    expect(textoCobertura(null, 5)).toBe("Sin consumo en 30 días");
    expect(textoCobertura(0, 3)).toBe("Se termina hoy");
    expect(textoCobertura(0, 0)).toBe("Ya no queda");
    expect(textoCobertura(null, -2)).toBe("Ya no queda");
    expect(textoCobertura(5, 50)).toBe("Te alcanza para ~5 días");
    expect(textoCobertura(1, 10)).toBe("Te alcanza para ~1 día");
  });
});

describe("paraComprar", () => {
  it("incluye bajo mínimo, negativos y ≤ 7 días; excluye el resto", () => {
    const r = paraComprar([
      item({ productId: "ok", stockQty: 100, consumo30: 30 }),
      item({ productId: "siete", stockQty: 7, consumo30: 30 }),
      item({ productId: "ocho", stockQty: 8, consumo30: 30 }),
      item({ productId: "min", stockQty: 4, minStockQty: 5 }),
      item({ productId: "enmin", stockQty: 5, minStockQty: 5 }),
      item({ productId: "neg", stockQty: -2 }),
      item({ productId: "noctrl", stockQty: 0, tracksStock: false }),
    ]).map((i) => i.productId);
    expect(r.sort()).toEqual(["min", "neg", "siete"]);
  });
  it("ordena negativos, después menos días, después nombre", () => {
    const r = paraComprar([
      item({ productId: "b", stockQty: 3, consumo30: 30 }),
      item({ productId: "a", stockQty: 3, consumo30: 30 }),
      item({ productId: "c", stockQty: 1, consumo30: 30 }),
      item({ productId: "n", stockQty: -1 }),
      item({ productId: "m", stockQty: 1, minStockQty: 5 }),
    ]).map((i) => i.productId);
    expect(r).toEqual(["n", "c", "a", "b", "m"]);
  });
});

describe("listaPorProveedor", () => {
  it("agrupa, sugiere cantidades y arma el texto", () => {
    const l = listaPorProveedor([
      item({ productId: "x", nombre: "Papel", stockQty: 2, minStockQty: 10, unidad: "hojas", proveedor: "Kodak" }),
      item({ productId: "y", nombre: "Kit 305", stockQty: 0, consumo30: 250, unidad: "copias", unidadCompra: "caja", unidadesPorCompra: 100, proveedor: "Kodak" }),
      item({ productId: "z", nombre: "Tinta", stockQty: -1, unidad: "ml", proveedor: " " }),
    ]);
    expect(l.map((g) => g.proveedor)).toEqual(["Kodak", "Sin proveedor"]);
    const kodak = l[0]!;
    expect(kodak.renglones.map((r) => r.texto)).toEqual(["3 caja Kit 305", "8 hojas Papel"]);
    expect(kodak.textoCopiable).toBe("Pedido para Kodak:\n- 3 caja Kit 305\n- 8 hojas Papel");
    expect(l[1]!.renglones[0]!.texto).toBe("1 ml Tinta");
  });
  it("agrupa proveedores sin importar mayúsculas ni espacios; muestra la primera escritura", () => {
    const l = listaPorProveedor([
      item({ productId: "a", nombre: "A", stockQty: -1, proveedor: "Foto  Sur" }),
      item({ productId: "b", nombre: "B", stockQty: 0, minStockQty: 2, proveedor: " foto sur " }),
      item({ productId: "c", nombre: "C", stockQty: 0, minStockQty: 2, proveedor: "FOTO SUR" }),
    ]);
    expect(l).toHaveLength(1);
    expect(l[0]!.proveedor).toBe("Foto Sur");
    expect(l[0]!.renglones).toHaveLength(3);
  });
  it("mínimo 1", () => {
    const l = listaPorProveedor([item({ productId: "q", nombre: "Q", stockQty: 0, minStockQty: null, consumo30: 0 })]);
    expect(l[0]!.renglones[0]!.texto).toBe("1 unidades Q");
  });
});
