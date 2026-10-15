import { describe, expect, it } from "vitest";
import { AJUSTES_COBRO_DE_FABRICA, datosTransferenciaPublicos, validarAjustesCobro } from "./datos";

describe("ajustes de cobro (etapa B)", () => {
  it("de fábrica: todo apagado, sin datos de transferencia", () => {
    expect(AJUSTES_COBRO_DE_FABRICA).toEqual({ autoConfirmarPedido: false, alias: null, cbuCvu: null, titular: null, cuit: null, banco: null, montoUnico: false });
    expect(datosTransferenciaPublicos(AJUSTES_COBRO_DE_FABRICA)).toBeNull();
  });

  it("valida alias, CBU/CVU (22 dígitos) y CUIT (11 dígitos); limpia espacios y guiones", () => {
    const r = validarAjustesCobro({ autoConfirmarPedido: true, alias: " dnx.estudio.mp ", cbuCvu: "0000003 100012345678901", titular: "Daniel Cuart", cuit: "20-12345678-3", banco: "Mercado Pago", montoUnico: true });
    expect(r).toEqual({ ok: true, valor: { autoConfirmarPedido: true, alias: "dnx.estudio.mp", cbuCvu: "0000003100012345678901", titular: "Daniel Cuart", cuit: "20123456783", banco: "Mercado Pago", montoUnico: true } });
    expect(validarAjustesCobro({ cbuCvu: "123" })).toEqual({ ok: false, error: "El CBU o CVU tiene que tener 22 números." });
    expect(validarAjustesCobro({ alias: "a b" })).toEqual({ ok: false, error: "El alias tiene de 6 a 20 caracteres: letras, números, puntos y guiones." });
    expect(validarAjustesCobro({ cuit: "20-1" })).toEqual({ ok: false, error: "El CUIT tiene que tener 11 números." });
    expect(validarAjustesCobro("x")).toEqual({ ok: false, error: "Los datos de cobro no son válidos." });
  });

  it("los datos públicos: alias o CBU alcanzan; sin ninguno, null", () => {
    const v = { ...AJUSTES_COBRO_DE_FABRICA, alias: "dnx.estudio.mp", titular: "Daniel Cuart" };
    expect(datosTransferenciaPublicos(v)).toEqual({ alias: "dnx.estudio.mp", cbuCvu: null, titular: "Daniel Cuart", cuit: null, banco: null });
    expect(datosTransferenciaPublicos({ ...AJUSTES_COBRO_DE_FABRICA, titular: "x" })).toBeNull();
  });
});
