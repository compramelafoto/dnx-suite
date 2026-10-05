// lib/course-marketplace/venta.test.ts
import { describe, expect, it } from "vitest";
import { decidirVenta, filasDeReparto, montosDeVenta } from "./venta";

const benef = [
  { id: "ws-sfpr", nombre: "SFPR", bps: 3000, absorbeMp: false },
  { id: "ws-prod", nombre: "Productora", bps: 2000, absorbeMp: false },
  { id: "ws-doc", nombre: "Docente", bps: 5000, absorbeMp: true },
];
const club = { workspaceId: "ws-club", nombre: "Fotoclub Norte", bps: 2500, descuentoSociosBps: 2500 };

describe("decidir si un curso se vende", () => {
  const sinReparto = { tipo: "SIN_REPARTO" as const };
  const listo = { tipo: "CON_REPARTO" as const, listo: true, faltantes: [] };
  const falta = { tipo: "CON_REPARTO" as const, listo: false, faltantes: ["Productora todavía no aceptó."] };

  it("sin reparto y vendido por el dueño: se vende como hoy, con el split apagado o no", () => {
    expect(decidirVenta({ estado: sinReparto, revendido: false, splitHabilitado: false })).toEqual({ tipo: "SIN_REPARTO" });
  });

  it("con el split apagado, todo lo revendido o con varios beneficiarios es 'próximamente'", () => {
    expect(decidirVenta({ estado: sinReparto, revendido: true, splitHabilitado: false }).tipo).toBe("PROXIMAMENTE");
    expect(decidirVenta({ estado: listo, revendido: false, splitHabilitado: false }).tipo).toBe("PROXIMAMENTE");
  });

  it("con el split encendido, se vende con reparto si todo está listo", () => {
    expect(decidirVenta({ estado: listo, revendido: true, splitHabilitado: true })).toEqual({ tipo: "CON_REPARTO" });
    expect(decidirVenta({ estado: sinReparto, revendido: true, splitHabilitado: true })).toEqual({ tipo: "CON_REPARTO" });
    expect(decidirVenta({ estado: falta, revendido: false, splitHabilitado: true })).toEqual({ tipo: "PROXIMAMENTE", motivo: "Productora todavía no aceptó." });
  });
});

describe("los montos de una venta (spec, sección 2.2)", () => {
  it("revendido al 25%, venta al público", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: club, esSocioDelVendedor: false });
    expect(m).toMatchObject({ ok: true, listPriceArs: "100000.00", discountArs: "0.00", platformFeeArs: "5000.00", amountArs: "105000.00", netAmountArs: "25000.00" });
    expect(m.ok && m.partes.map((p) => [p.id, p.centavos])).toEqual([
      ["ws-club", 2_500_000],
      ["ws-sfpr", 2_250_000],
      ["ws-prod", 1_500_000],
      ["ws-doc", 3_750_000],
      ["plataforma", 500_000],
    ]);
  });

  it("el socio del revendedor recibe su descuento; los demás cobran igual", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: club, esSocioDelVendedor: true });
    expect(m).toMatchObject({ ok: true, discountArs: "25000.00", amountArs: "80000.00", netAmountArs: "0.00" });
    expect(m.ok && m.partes.find((p) => p.id === "ws-doc")?.centavos).toBe(3_750_000);
  });

  it("quien no es socio no recibe el descuento", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: club, esSocioDelVendedor: false });
    expect(m.ok && m.discountArs).toBe("0.00");
  });

  it("un descuento mayor que la parte del revendedor lo rechaza el motor", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: { ...club, descuentoSociosBps: 3000 }, esSocioDelVendedor: true });
    expect(m.ok).toBe(false);
  });

  it("sin reventa, con varios beneficiarios: vende uno de ellos y su neto es su parte", () => {
    const m = montosDeVenta({ listaArs: "100000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-sfpr", reventa: null, esSocioDelVendedor: true });
    expect(m).toMatchObject({ ok: true, amountArs: "105000.00", netAmountArs: "30000.00" });
  });
});

describe("las filas del reparto congelado", () => {
  it("una por parte; la plataforma sin negocio", () => {
    const m = montosDeVenta({ listaArs: "1000", comisionPlataformaBps: 500, beneficiarios: benef, vendedorWorkspaceId: "ws-club", reventa: club, esSocioDelVendedor: false });
    if (!m.ok) throw new Error(m.error);
    const filas = filasDeReparto(m.partes);
    expect(filas[0]).toEqual({ workspaceId: "ws-club", kind: "REVENDEDOR", label: "Fotoclub Norte", amountArs: "250.00", absorbsProcessorFee: false });
    expect(filas.at(-1)).toEqual({ workspaceId: null, kind: "PLATAFORMA", label: "Plataforma", amountArs: "50.00", absorbsProcessorFee: false });
  });
});
