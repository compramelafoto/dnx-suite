import { describe, expect, it } from "vitest";
import {
  arsACentavos, calcularCarrito, centavosAArs, formatearCentavos, textoFaltanParaPaquete, validarConfigVenta,
  validarReglasDescuento, type ConfigVenta, type FotoSeleccionada,
} from "./precios";

const base: ConfigVenta = {
  saleMode: "SELECCION_Y_VENTA", includedCount: 0, pricingMode: "POR_FOTO", unitPriceCents: 1000_00, packageSize: null,
  packagePriceCents: null, discountMode: "NINGUNO", discountPct: null, discountRules: null,
};
const sel = (n: number, desde = 0): FotoSeleccionada[] =>
  Array.from({ length: n }, (_, i) => ({ fotoId: `f${i + desde + 1}`, seleccionadaEn: new Date(2026, 9, 1, 10, i + desde) }));
const nada = new Set<string>();

describe("dinero", () => {
  it("convierte a centavos y vuelta", () => {
    expect(arsACentavos("1234.50")).toBe(123450);
    expect(arsACentavos("1234,5")).toBe(123450);
    expect(arsACentavos(0.1 + 0.2)).toBe(30);
    expect(arsACentavos("abc")).toBeNull();
    expect(arsACentavos(null)).toBeNull();
    expect(centavosAArs(123450)).toBe("1234.50");
    expect(centavosAArs(5)).toBe("0.05");
    expect(formatearCentavos(123450)).toContain("1.234,50");
  });
});

describe("validarReglasDescuento", () => {
  it("acepta reglas válidas", () => {
    expect(validarReglasDescuento([{ pct: 5, desde: 2 }, { pct: 90, desde: 10 }]).ok).toBe(true);
  });
  it.each([
    ["no array", {}], ["vacío", []], ["5 reglas", [2, 3, 4, 5, 6].map((d) => ({ pct: 5, desde: d }))],
    ["pct 0", [{ pct: 0, desde: 2 }]], ["pct 91", [{ pct: 91, desde: 2 }]], ["pct decimal", [{ pct: 5.5, desde: 2 }]],
    ["desde 1", [{ pct: 5, desde: 1 }]], ["desde decimal", [{ pct: 5, desde: 2.5 }]],
    ["repetidas", [{ pct: 5, desde: 3 }, { pct: 8, desde: 3 }]],
    ["desordenadas", [{ pct: 5, desde: 5 }, { pct: 8, desde: 3 }]], ["no objeto", [3]], ["null", [null]],
  ])("rechaza %s", (_n, v) => {
    expect(validarReglasDescuento(v).ok).toBe(false);
  });
  it("acepta exactamente 4", () => {
    expect(validarReglasDescuento([2, 3, 4, 5].map((d) => ({ pct: 5, desde: d }))).ok).toBe(true);
  });
});

describe("validarConfigVenta", () => {
  it("SELECCION no exige precio", () => {
    expect(validarConfigVenta({ ...base, saleMode: "SELECCION", pricingMode: null, unitPriceCents: null })).toEqual({ ok: true });
  });
  it("incluidas negativas o decimales", () => {
    expect(validarConfigVenta({ ...base, includedCount: -1 }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, includedCount: 1.5 }).ok).toBe(false);
  });
  it("VENTA exige 0 incluidas", () => {
    expect(validarConfigVenta({ ...base, saleMode: "VENTA", includedCount: 3 }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, saleMode: "VENTA", includedCount: 0 }).ok).toBe(true);
  });
  it("exige modo de precio completo", () => {
    expect(validarConfigVenta({ ...base, pricingMode: null }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, unitPriceCents: null }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, unitPriceCents: 0 }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, pricingMode: "PAQUETE", packageSize: 1, packagePriceCents: 100 }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, pricingMode: "PAQUETE", packageSize: 5, packagePriceCents: null }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, pricingMode: "PAQUETE", packageSize: 5, packagePriceCents: 100 }).ok).toBe(true);
  });
  it("acumula errores en español", () => {
    const r = validarConfigVenta({ ...base, pricingMode: "PAQUETE", packageSize: 1, packagePriceCents: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toHaveLength(2);
  });
  it("descuento único y progresivo", () => {
    expect(validarConfigVenta({ ...base, discountMode: "UNICO", discountPct: null }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, discountMode: "UNICO", discountPct: 91 }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, discountMode: "UNICO", discountPct: 10 }).ok).toBe(true);
    expect(validarConfigVenta({ ...base, discountMode: "PROGRESIVO", discountRules: [] }).ok).toBe(false);
    expect(validarConfigVenta({ ...base, discountMode: "PROGRESIVO", discountRules: [{ pct: 5, desde: 2 }] }).ok).toBe(true);
  });
  it("no usa la palabra plata", () => {
    const r = validarConfigVenta({ ...base, pricingMode: null, discountMode: "UNICO" });
    if (!r.ok) expect(r.errores.join(" ")).not.toMatch(/plata/i);
  });
});

describe("calcularCarrito por foto", () => {
  it("0 extras", () => {
    const c = calcularCarrito({ config: base, seleccion: [], pagadas: nada });
    expect(c).toMatchObject({ extras: [], totalCents: 0, subtotalCents: 0, reglaAplicada: null });
  });
  it("exactamente N incluidas: sin extras", () => {
    const c = calcularCarrito({ config: { ...base, includedCount: 5 }, seleccion: sel(5), pagadas: nada });
    expect(c.incluidas).toHaveLength(5);
    expect(c.extras).toHaveLength(0);
    expect(c.totalCents).toBe(0);
  });
  it("N+1: la última elegida es la extra", () => {
    const c = calcularCarrito({ config: { ...base, includedCount: 5 }, seleccion: sel(6), pagadas: nada });
    expect(c.extras).toEqual(["f6"]);
    expect(c.incluidas).toEqual(["f1", "f2", "f3", "f4", "f5"]);
    expect(c.totalCents).toBe(100000);
  });
  it("incluidas por fecha de selección, no por orden del arreglo; desempata por id", () => {
    const seleccion: FotoSeleccionada[] = [
      { fotoId: "c", id: "s3", seleccionadaEn: new Date(2026, 9, 1, 12) },
      { fotoId: "a", id: "s1", seleccionadaEn: new Date(2026, 9, 1, 10) },
      { fotoId: "b", id: "s2", seleccionadaEn: new Date(2026, 9, 1, 10) },
    ];
    const c = calcularCarrito({ config: { ...base, includedCount: 2 }, seleccion, pagadas: nada });
    expect(c.incluidas).toEqual(["a", "b"]);
    expect(c.extras).toEqual(["c"]);
  });
  it("VENTA con includedCount 0 cobra todas (ignora includedCount residual)", () => {
    const c = calcularCarrito({ config: { ...base, saleMode: "VENTA", includedCount: 3 }, seleccion: sel(3), pagadas: nada });
    expect(c.incluidas).toEqual([]);
    expect(c.extras).toHaveLength(3);
    expect(c.totalCents).toBe(300000);
  });
  it("SELECCION nunca cobra", () => {
    const c = calcularCarrito({ config: { ...base, saleMode: "SELECCION" }, seleccion: sel(4), pagadas: nada });
    expect(c.extras).toEqual([]);
    expect(c.totalCents).toBe(0);
  });
  it("configuración incompleta no cobra", () => {
    const c = calcularCarrito({ config: { ...base, unitPriceCents: null }, seleccion: sel(4), pagadas: nada });
    expect(c.extras).toEqual([]);
    expect(c.totalCents).toBe(0);
  });
  it("compras previas: las pagadas no se cobran ni consumen incluidas", () => {
    const c = calcularCarrito({ config: { ...base, includedCount: 1 }, seleccion: sel(5), pagadas: new Set(["f1", "f2", "f3"]) });
    expect(c.yaPagadas).toEqual(["f1", "f2", "f3"]);
    expect(c.incluidas).toEqual(["f4"]);
    expect(c.extras).toEqual(["f5"]);
    expect(c.totalCents).toBe(100000);
  });
  it("todo pagado: total 0", () => {
    const c = calcularCarrito({ config: base, seleccion: sel(2), pagadas: new Set(["f1", "f2"]) });
    expect(c.extras).toEqual([]);
    expect(c.totalCents).toBe(0);
  });
  it("ignora fotos repetidas en la selección", () => {
    const s = [...sel(2), ...sel(2)];
    expect(calcularCarrito({ config: base, seleccion: s, pagadas: nada }).extras).toHaveLength(2);
  });
});

describe("calcularCarrito por paquete", () => {
  const paq: ConfigVenta = { ...base, pricingMode: "PAQUETE", unitPriceCents: null, packageSize: 5, packagePriceCents: 4000_00 };
  it("redondea hacia arriba y avisa cuántas faltan", () => {
    const c = calcularCarrito({ config: paq, seleccion: sel(7), pagadas: nada });
    expect(c.paquetes).toBe(2);
    expect(c.fotosQueFaltanParaPaquete).toBe(3);
    expect(c.subtotalCents).toBe(800000);
    expect(textoFaltanParaPaquete(c.fotosQueFaltanParaPaquete)).toBe("Con 3 fotos más completás el paquete sin costo adicional.");
  });
  it("paquete justo: no falta ninguna", () => {
    const c = calcularCarrito({ config: paq, seleccion: sel(10), pagadas: nada });
    expect(c.paquetes).toBe(2);
    expect(c.fotosQueFaltanParaPaquete).toBe(0);
    expect(textoFaltanParaPaquete(0)).toBeNull();
  });
  it("1 extra = 1 paquete, falta 1 en singular", () => {
    const c = calcularCarrito({ config: paq, seleccion: sel(1), pagadas: nada });
    expect(c.paquetes).toBe(1);
    expect(c.fotosQueFaltanParaPaquete).toBe(4);
    expect(textoFaltanParaPaquete(1)).toBe("Con 1 foto más completás el paquete sin costo adicional.");
  });
  it("sin extras no hay paquetes", () => {
    const c = calcularCarrito({ config: { ...paq, includedCount: 3 }, seleccion: sel(3), pagadas: nada });
    expect(c.paquetes).toBeNull();
    expect(c.totalCents).toBe(0);
  });
  it("progresivo cuenta las fotos de los paquetes", () => {
    const cfg: ConfigVenta = { ...paq, discountMode: "PROGRESIVO", discountRules: [{ pct: 10, desde: 10 }] };
    // 6 extras -> 2 paquetes -> 10 fotos: alcanza la regla aunque haya 6 elegidas.
    const c = calcularCarrito({ config: cfg, seleccion: sel(6), pagadas: nada });
    expect(c.reglaAplicada).toEqual({ tipo: "PROGRESIVO", pct: 10, desde: 10 });
    expect(c.descuentoCents).toBe(80000);
    expect(c.totalCents).toBe(720000);
    // 5 extras -> 1 paquete -> 5 fotos: no alcanza.
    expect(calcularCarrito({ config: cfg, seleccion: sel(5), pagadas: nada }).reglaAplicada).toBeNull();
  });
});

describe("descuentos", () => {
  it("único sobre el subtotal", () => {
    const c = calcularCarrito({ config: { ...base, discountMode: "UNICO", discountPct: 20 }, seleccion: sel(5), pagadas: nada });
    expect(c.subtotalCents).toBe(500000);
    expect(c.descuentoCents).toBe(100000);
    expect(c.totalCents).toBe(400000);
    expect(c.reglaAplicada).toEqual({ tipo: "UNICO", pct: 20, desde: null });
  });
  const prog: ConfigVenta = { ...base, discountMode: "PROGRESIVO", discountRules: [{ pct: 5, desde: 3 }, { pct: 10, desde: 5 }, { pct: 20, desde: 10 }] };
  it.each([
    [1, null], [2, null], [3, 5], [4, 5], [5, 10], [9, 10], [10, 20], [25, 20],
  ])("progresivo con %i extras", (n, pct) => {
    const c = calcularCarrito({ config: prog, seleccion: sel(n), pagadas: nada });
    expect(c.reglaAplicada?.pct ?? null).toBe(pct);
    expect(c.totalCents).toBe(c.subtotalCents - c.descuentoCents);
  });
  it("progresivo cuenta sólo las extras de esta compra (con previas y incluidas)", () => {
    const c = calcularCarrito({ config: { ...prog, includedCount: 2 }, seleccion: sel(8), pagadas: new Set(["f1", "f2", "f3", "f4"]) });
    // pendientes: f5..f8 (4); 2 incluidas, 2 extras -> no llega a 3.
    expect(c.extras).toHaveLength(2);
    expect(c.reglaAplicada).toBeNull();
  });
  it("redondea al centavo", () => {
    // 3 fotos x $0,33 = 99 centavos; 10% = 9,9 -> 10
    const c = calcularCarrito({ config: { ...base, unitPriceCents: 33, discountMode: "UNICO", discountPct: 10 }, seleccion: sel(3), pagadas: nada });
    expect(c.subtotalCents).toBe(99);
    expect(c.descuentoCents).toBe(10);
    expect(c.totalCents).toBe(89);
  });
  it("redondea .5 hacia arriba y nunca deja negativo", () => {
    const c = calcularCarrito({ config: { ...base, unitPriceCents: 5, discountMode: "UNICO", discountPct: 90 }, seleccion: sel(1), pagadas: nada });
    expect(c.descuentoCents).toBe(5 - c.totalCents);
    expect(c.totalCents).toBeGreaterThanOrEqual(0);
    const d = calcularCarrito({ config: { ...base, unitPriceCents: 1, discountMode: "UNICO", discountPct: 90 }, seleccion: sel(1), pagadas: nada });
    expect(d.descuentoCents).toBe(1);
    expect(d.totalCents).toBe(0);
  });
});
