import { describe, expect, it } from "vitest";
import type { ProductoCopia } from "@/lib/impresiones/catalogo-copias";
import { medidaEnMm, opcionesDelCatalogo, renglonesDelPedido, type PiezaLab } from "./laboratorio";

const P = (id: string, medida: string, plazo: ProductoCopia["plazo"], desde: number, precio: number, proveedorId: string | null = null): ProductoCopia => ({
  id, medida, plazo, desde, precio, costo: null, proveedorId,
});

const CATALOGO: ProductoCopia[] = [
  P("i1015", "10x15", "INSTANTANEA", 0, 5000),
  P("m1015", "10x15", "MANANA", 10, 3000, "fotolag"),
  P("s1015", "10x15", "SEMANA", 10, 2000, "fotolag"),
  P("i1318", "13x18", "INSTANTANEA", 0, 7000),
  P("m1318", "13x18", "MANANA", 10, 4500, "fotolag"),
  P("s1318", "13x18", "SEMANA", 10, 3500, "fotolag"),
  P("m2030", "20x30", "MANANA", 0, 4500, "fotolag"),
  P("s2030", "20x30", "SEMANA", 0, 3000, "fotolag"),
  P("s3040", "30x40", "SEMANA", 0, 11700, "isla"),
];

const pieza = (originalId: string, medida: string, plazo: PiezaLab["plazo"], papel: PiezaLab["papel"], cantidad: number): PiezaLab => ({ originalId, medida, plazo, papel, cantidad });

describe("medidaEnMm", () => {
  it("usa las medidas reales del papel y A·10 × B·10 para el resto", () => {
    expect(medidaEnMm("10x15")).toEqual({ anchoMm: 102, altoMm: 152 });
    expect(medidaEnMm("13x18")).toEqual({ anchoMm: 127, altoMm: 180 });
    expect(medidaEnMm("15x21")).toEqual({ anchoMm: 152, altoMm: 210 });
    expect(medidaEnMm("20x30")).toEqual({ anchoMm: 203, altoMm: 300 });
    expect(medidaEnMm("25x38")).toEqual({ anchoMm: 254, altoMm: 380 });
    expect(medidaEnMm("30x45")).toEqual({ anchoMm: 300, altoMm: 450 });
    expect(medidaEnMm("abc")).toBeNull();
  });
});

describe("opcionesDelCatalogo", () => {
  it("excluye la instantánea y ordena por lado corto y largo", () => {
    const o = opcionesDelCatalogo(CATALOGO, null);
    expect(o.medidas.map((m) => m.medida)).toEqual(["10x15", "13x18", "20x30", "30x40"]);
    expect(o.medidas[0].plazos).toEqual(["MANANA", "SEMANA"]);
    expect(o.medidas[3].plazos).toEqual(["SEMANA"]);
  });
  it("filtra los papeles por settings", () => {
    expect(opcionesDelCatalogo(CATALOGO, { mate: false, brillo: true }).papeles).toEqual(["BRILLO"]);
    expect(opcionesDelCatalogo(CATALOGO, null).papeles).toEqual(["MATE", "BRILLO"]);
  });
});

describe("renglonesDelPedido", () => {
  const sinMapa = new Map<string, string | null>();
  it("24 copias 10x15 semana -> un renglón", () => {
    const r = renglonesDelPedido([pieza("a", "10x15", "SEMANA", "MATE", 24)], CATALOGO, sinMapa);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.renglones).toHaveLength(1);
    expect(r.renglones[0]).toMatchObject({ productId: "s1015", cantidad: 24, precioUnitario: 2000 });
  });
  it("el papel no separa productos", () => {
    const r = renglonesDelPedido([pieza("a", "10x15", "SEMANA", "MATE", 12), pieza("b", "10x15", "SEMANA", "BRILLO", 12)], CATALOGO, sinMapa);
    expect(r.ok && r.renglones).toHaveLength(1);
    if (r.ok) expect(r.renglones[0].cantidad).toBe(24);
  });
  it("pocas copias en dos plazos caen en el instantáneo y se juntan", () => {
    const r = renglonesDelPedido([pieza("a", "13x18", "SEMANA", "MATE", 3), pieza("b", "13x18", "MANANA", "MATE", 2)], CATALOGO, sinMapa);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.renglones).toHaveLength(1);
    expect(r.renglones[0]).toMatchObject({ productId: "i1318", cantidad: 5, proveedorId: "fotolag" });
    expect(r.plazoFinal.get("a")).toBe("MANANA");
    expect(r.plazoFinal.get("b")).toBe("MANANA");
    expect(r.renglones[0].claves).toEqual(["13x18|MANANA"]);
  });
  it("medida sin producto -> error", () => {
    const r = renglonesDelPedido([pieza("a", "40x60", "SEMANA", "MATE", 1)], CATALOGO, sinMapa);
    expect(r).toEqual({ ok: false, error: "No hay precio para 40x60 próxima semana en el catálogo." });
  });
  it("proveedorDeProducto gana sobre el del producto", () => {
    const r = renglonesDelPedido([pieza("a", "20x30", "MANANA", "MATE", 1)], CATALOGO, new Map([["m2030", "otro"]]));
    expect(r.ok && r.renglones[0].proveedorId).toBe("otro");
  });
});
