import { describe, expect, it } from "vitest";
import { claveDeItemAgregado, itemsParaElAgregado, netoDelItem } from "./agregar-item-puro";

describe("claveDeItemAgregado", () => {
  it("no usa el prefijo de los cargos (cuenta como ítem real)", () => {
    expect(claveDeItemAgregado("abc12345")).toBe("ag-abc12345");
    expect(claveDeItemAgregado("abc12345").startsWith("cargo-")).toBe(false);
  });
});

describe("netoDelItem", () => {
  it("cantidad por precio, sin errores de redondeo", () => {
    expect(netoDelItem({ cantidad: 3, precioUnitario: 0.1 })).toBe(0.3);
    expect(netoDelItem({ cantidad: 1, precioUnitario: 25_000 })).toBe(25_000);
    expect(netoDelItem({ cantidad: 2, precioUnitario: 0 })).toBe(0);
  });
});

describe("itemsParaElAgregado", () => {
  it("deja vivo sólo el renglón nuevo, en su posición", () => {
    const items = [{ id: "m1", opcional: false }, { id: "m2", opcional: false }, { id: "ag-x", opcional: false }];
    const r = itemsParaElAgregado(items, 2);
    expect(r.map((i) => i.opcional)).toEqual([true, true, false]);
    expect(r[2]).toBe(items[2]);
    expect(items[0]!.opcional).toBe(false); // no toca el original
  });
});
