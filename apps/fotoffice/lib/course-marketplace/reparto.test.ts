import { describe, expect, it } from "vitest";
import { calcularReparto, formatoPorcentaje, topeDeDescuentoBps, type BeneficiarioEntrada } from "./reparto";

const L = 10_000_000; // $100.000 en centavos
const benef: BeneficiarioEntrada[] = [
  { id: "sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "prod", nombre: "Productora", bps: 2000, absorbeMp: false },
  { id: "doc", nombre: "Docente", bps: 5000, absorbeMp: true },
];

function monto(r: ReturnType<typeof calcularReparto>, id: string) {
  if (!r.ok) throw new Error(r.errores.join(" / "));
  return r.partes.find((p) => p.id === id)?.centavos;
}

function sumaCierra(r: ReturnType<typeof calcularReparto>) {
  if (!r.ok) throw new Error(r.errores.join(" / "));
  return r.partes.reduce((s, p) => s + p.centavos, 0) === r.pagaElAlumno;
}

describe("el reparto de una venta", () => {
  it("venta al público: el 5% va encima y cada uno cobra su porcentaje de la lista", () => {
    const r = calcularReparto({ listaCentavos: L, comisionPlataformaBps: 500, beneficiarios: benef, vendedorId: "sfpr" });
    expect(r.ok && r.pagaElAlumno).toBe(10_500_000);
    expect(monto(r, "plataforma")).toBe(500_000);
    expect(monto(r, "sfpr")).toBe(3_000_000);
    expect(monto(r, "prod")).toBe(2_000_000);
    expect(monto(r, "doc")).toBe(5_000_000);
    expect(sumaCierra(r)).toBe(true);
  });

  it("el que vende regala su parte: sólo él deja de cobrar, el 5% sigue sobre la lista", () => {
    const r = calcularReparto({ listaCentavos: L, comisionPlataformaBps: 500, beneficiarios: benef, vendedorId: "sfpr", descuentoBps: 3000 });
    expect(r.ok && r.pagaElAlumno).toBe(7_500_000);
    expect(r.ok && r.descuento).toBe(3_000_000);
    expect(monto(r, "sfpr")).toBe(0);
    expect(monto(r, "prod")).toBe(2_000_000);
    expect(monto(r, "doc")).toBe(5_000_000);
    expect(sumaCierra(r)).toBe(true);
  });

  it("reventa: el % del revendedor sale de arriba y el resto se reparte en proporción", () => {
    const r = calcularReparto({
      listaCentavos: L,
      comisionPlataformaBps: 500,
      beneficiarios: benef,
      reventa: { id: "club", nombre: "Fotoclub", bps: 2500 },
    });
    expect(monto(r, "club")).toBe(2_500_000);
    expect(monto(r, "sfpr")).toBe(2_250_000);
    expect(monto(r, "prod")).toBe(1_500_000);
    expect(monto(r, "doc")).toBe(3_750_000);
    expect(sumaCierra(r)).toBe(true);
  });

  it("reventa con descuento: el descuento sale sólo del revendedor", () => {
    const r = calcularReparto({
      listaCentavos: L,
      comisionPlataformaBps: 500,
      beneficiarios: benef,
      reventa: { id: "club", nombre: "Fotoclub", bps: 2500 },
      descuentoBps: 2500,
    });
    expect(r.ok && r.pagaElAlumno).toBe(8_000_000);
    expect(monto(r, "club")).toBe(0);
    expect(monto(r, "doc")).toBe(3_750_000);
    expect(sumaCierra(r)).toBe(true);
  });

  it("un solo beneficiario cobra toda la lista", () => {
    const r = calcularReparto({
      listaCentavos: L,
      comisionPlataformaBps: 500,
      beneficiarios: [{ id: "maxi", nombre: "Maxi", bps: 10000, absorbeMp: true }],
      vendedorId: "maxi",
    });
    expect(monto(r, "maxi")).toBe(L);
    expect(sumaCierra(r)).toBe(true);
  });

  it("los centavos que sobran por redondeo van a quien absorbe Mercado Pago", () => {
    const r = calcularReparto({
      listaCentavos: 10_001,
      comisionPlataformaBps: 500,
      beneficiarios: [
        { id: "a", nombre: "A", bps: 3333, absorbeMp: false },
        { id: "b", nombre: "B", bps: 3333, absorbeMp: false },
        { id: "c", nombre: "C", bps: 3334, absorbeMp: true },
      ],
      vendedorId: "a",
    });
    expect(monto(r, "a")).toBe(3333);
    expect(monto(r, "b")).toBe(3333);
    expect(monto(r, "c")).toBe(3335);
    expect(sumaCierra(r)).toBe(true);
  });

  it("la suma cierra siempre, con precios y porcentajes incómodos", () => {
    for (const lista of [1, 99, 12_345, 9_999_999, 123_456_789]) {
      for (const desc of [0, 1, 777, 3000]) {
        const r = calcularReparto({ listaCentavos: lista, comisionPlataformaBps: 500, beneficiarios: benef, vendedorId: "sfpr", descuentoBps: desc });
        expect(sumaCierra(r)).toBe(true);
        const rv = calcularReparto({ listaCentavos: lista, comisionPlataformaBps: 500, beneficiarios: benef, reventa: { id: "x", nombre: "X", bps: 3100 }, descuentoBps: desc });
        expect(sumaCierra(rv)).toBe(true);
      }
    }
  });

  it("ninguna parte queda negativa", () => {
    const r = calcularReparto({ listaCentavos: 99, comisionPlataformaBps: 500, beneficiarios: benef, vendedorId: "sfpr", descuentoBps: 3000 });
    expect(r.ok && r.partes.every((p) => p.centavos >= 0)).toBe(true);
  });
});

describe("lo que el motor rechaza", () => {
  const base = { listaCentavos: L, comisionPlataformaBps: 500, vendedorId: "sfpr" };

  it("porcentajes que no suman 100%", () => {
    const r = calcularReparto({ ...base, beneficiarios: benef.map((b) => (b.id === "doc" ? { ...b, bps: 4500 } : b)) });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores.join()).toMatch(/suman 95%/);
  });

  it("nadie o dos que absorben Mercado Pago", () => {
    expect(calcularReparto({ ...base, beneficiarios: benef.map((b) => ({ ...b, absorbeMp: false })) }).ok).toBe(false);
    expect(calcularReparto({ ...base, beneficiarios: benef.map((b) => ({ ...b, absorbeMp: true })) }).ok).toBe(false);
  });

  it("un descuento mayor que la parte de quien vende", () => {
    const r = calcularReparto({ ...base, beneficiarios: benef, descuentoBps: 3500 });
    expect(!r.ok && r.errores.join()).toMatch(/no puede superar 30%/);
  });

  it("precio cero o negativo", () => {
    expect(calcularReparto({ ...base, beneficiarios: benef, listaCentavos: 0 }).ok).toBe(false);
  });

  it("más receptores de los que acepta Mercado Pago", () => {
    const muchos = Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, nombre: `B${i}`, bps: i === 0 ? 10000 - 11 * 800 : 800, absorbeMp: i === 0 }));
    expect(calcularReparto({ ...base, beneficiarios: muchos, vendedorId: "b0" }).ok).toBe(false);
  });
});

describe("ayudantes", () => {
  it("tope del descuento: con reventa es su %, sin reventa la parte de quien vende", () => {
    expect(topeDeDescuentoBps({ beneficiarios: benef, reventa: { id: "x", nombre: "X", bps: 2500 } })).toBe(2500);
    expect(topeDeDescuentoBps({ beneficiarios: benef, vendedorId: "sfpr" })).toBe(3000);
    expect(topeDeDescuentoBps({ beneficiarios: benef, vendedorId: "nadie" })).toBe(0);
  });

  it("formato del porcentaje", () => {
    expect(formatoPorcentaje(3000)).toBe("30%");
    expect(formatoPorcentaje(1250)).toBe("12,5%");
  });
});
