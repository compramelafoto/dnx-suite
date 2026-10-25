import { describe, expect, it } from "vitest";
import { CONSUMIDOR_FINAL, leerFormulario, receptorSugerido, renglonesDeVenta, type FormularioFactura } from "./borrador";

const F: FormularioFactura = {
  anonimo: true,
  docTipo: "",
  docNro: "",
  nombre: "",
  ivaCondition: "CONSUMIDOR_FINAL",
  domicilio: "",
  concepto: "1",
  fecha: "2026-10-25",
  servDesde: "",
  servHasta: "",
  vtoPago: "",
};

describe("borrador de factura", () => {
  it("sin cliente, consumidor final", () => {
    expect(receptorSugerido(null)).toEqual(CONSUMIDOR_FINAL);
  });
  it("con cliente con DNI propone sus datos y su condición", () => {
    const r = receptorSugerido({ nombre: "Pérez, Ana", docType: "DNI", docNumber: "30.123.456", ivaCondition: "CONSUMIDOR_FINAL", domicilio: null });
    expect(r).toMatchObject({ docTipo: 96, docNro: "30123456", condicionIvaId: 5, nombre: "Pérez, Ana" });
    const m = receptorSugerido({ nombre: "Foto SRL", docType: "CUIT", docNumber: "30-00000000-7", ivaCondition: "MONOTRIBUTO", domicilio: "Rosario" });
    expect(m).toMatchObject({ docTipo: 80, docNro: "30000000007", condicionIvaId: 6 });
  });
  it("lee el formulario anónimo de productos", () => {
    expect(leerFormulario(F)).toEqual({ ok: true, datos: { receptor: CONSUMIDOR_FINAL, concepto: 1, fecha: "20261025", servicio: null } });
  });
  it("con servicios exige las tres fechas", () => {
    expect(leerFormulario({ ...F, concepto: "2" }).ok).toBe(false);
    const r = leerFormulario({ ...F, concepto: "2", servDesde: "2026-10-01", servHasta: "2026-10-20", vtoPago: "2026-10-30" });
    expect(r).toMatchObject({ ok: true, datos: { servicio: { desde: "20261001", hasta: "20261020", vtoPago: "20261030" } } });
  });
  it("con receptor identificado pide documento, nombre y condición", () => {
    expect(leerFormulario({ ...F, anonimo: false, docTipo: "96", docNro: "", nombre: "x" }).ok).toBe(false);
    expect(leerFormulario({ ...F, anonimo: false, docTipo: "96", docNro: "30123456", nombre: "Ana", ivaCondition: "MONOTRIBUTO" })).toMatchObject({
      ok: true,
      datos: { receptor: { docTipo: 96, condicionIvaId: 6 } },
    });
  });
  it("el descuento de la venta va como renglón aparte para que cierre el total", () => {
    const r = renglonesDeVenta([{ description: "Trípode", qty: 1, unitPriceMinor: 10000, lineTotalMinor: 10000 }], 9000);
    expect(r[1]).toEqual({ description: "Descuento", qty: 1, unitPriceMinor: -1000, lineTotalMinor: -1000 });
    expect(r.reduce((a, x) => a + x.lineTotalMinor, 0)).toBe(9000);
  });
});
