import { describe, expect, it } from "vitest";
import { leerPedidoApertura, planDeApertura, type CuentaExistente } from "./apertura";

const EXISTENTES: CuentaExistente[] = [
  { id: "a1", name: "Caja diaria", kind: "EFECTIVO", isVault: false, isActive: true },
  { id: "a2", name: "Caja fuerte", kind: "EFECTIVO", isVault: true, isActive: true },
  { id: "a3", name: "Mercado Pago", kind: "DIGITAL", isVault: false, isActive: true },
];

describe("planDeApertura", () => {
  it("Mercado Pago en 0 no necesita asiento; los saldos sin informar quedan pendientes", () => {
    const pasos = planDeApertura(
      [
        { nombre: "Mercado Pago", tipo: "DIGITAL", esBoveda: false, saldoCentavos: 0 },
        { nombre: "Caja fuerte", tipo: "EFECTIVO", esBoveda: true, saldoCentavos: null },
        { nombre: "Mostrador", tipo: "EFECTIVO", esBoveda: false, saldoCentavos: null, tambien: ["Caja diaria"] },
      ],
      EXISTENTES,
      [],
    );
    expect(pasos).toEqual([
      { tipo: "sin-cambios", cuenta: "Mercado Pago", cuentaId: "a3", motivo: expect.stringMatching(/0/) },
      { tipo: "pendiente", cuenta: "Caja fuerte", cuentaId: "a2", motivo: expect.stringMatching(/sin informar/) },
      { tipo: "pendiente", cuenta: "Mostrador", cuentaId: "a1", motivo: expect.stringMatching(/Caja diaria/) },
    ]);
  });

  it("crea la cuenta que falta y registra su saldo", () => {
    const pasos = planDeApertura([{ nombre: "Mostrador", tipo: "EFECTIVO", esBoveda: false, saldoCentavos: 12_345_00 }], EXISTENTES, []);
    expect(pasos).toEqual([
      { tipo: "crear-cuenta", cuenta: "Mostrador", kind: "EFECTIVO", isVault: false },
      { tipo: "registrar-saldo", cuenta: "Mostrador", cuentaId: null, centavos: 12_345_00 },
    ]);
  });

  it("registra el saldo de una cuenta existente (por nombre, sin mayúsculas)", () => {
    const pasos = planDeApertura([{ nombre: "caja FUERTE", tipo: "EFECTIVO", esBoveda: true, saldoCentavos: 500_000_00 }], EXISTENTES, []);
    expect(pasos).toEqual([{ tipo: "registrar-saldo", cuenta: "caja FUERTE", cuentaId: "a2", centavos: 500_000_00 }]);
  });

  it("un saldo ya cargado igual no se toca; distinto se reemplaza (anular y cargar) sólo a propósito", () => {
    const pedido = [{ nombre: "Caja fuerte", tipo: "EFECTIVO" as const, esBoveda: true, saldoCentavos: 600_000_00 }];
    expect(planDeApertura(pedido, EXISTENTES, [{ accountId: "a2", movementId: "m1", centavos: 600_000_00 }])[0].tipo).toBe("sin-cambios");
    const sin = planDeApertura(pedido, EXISTENTES, [{ accountId: "a2", movementId: "m1", centavos: 500_000_00 }]);
    expect(sin[0]).toMatchObject({ tipo: "conflicto", motivo: expect.stringMatching(/--reemplazar/) });
    const con = planDeApertura(pedido, EXISTENTES, [{ accountId: "a2", movementId: "m1", centavos: 500_000_00 }], { reemplazar: true });
    expect(con).toEqual([{ tipo: "reemplazar-saldo", cuenta: "Caja fuerte", cuentaId: "a2", movimientoId: "m1", deCentavos: 500_000_00, aCentavos: 600_000_00 }]);
  });

  it("dejar en $0 un saldo inicial cargado: conflicto sin --reemplazar; con --reemplazar sólo se anula", () => {
    const pedido = [{ nombre: "Caja fuerte", tipo: "EFECTIVO" as const, esBoveda: true, saldoCentavos: 0 }];
    const previa = [{ accountId: "a2", movementId: "m", centavos: 5 }];
    expect(planDeApertura(pedido, EXISTENTES, previa)[0].tipo).toBe("conflicto");
    expect(planDeApertura(pedido, EXISTENTES, previa, { reemplazar: true })).toEqual([
      { tipo: "reemplazar-saldo", cuenta: "Caja fuerte", cuentaId: "a2", movimientoId: "m", deCentavos: 5, aCentavos: 0 },
    ]);
  });

  it("conflictos: tipo distinto, cuenta dada de baja, saldo negativo", () => {
    const p = (x: Partial<Parameters<typeof planDeApertura>[0][number]>) => ({ nombre: "Caja fuerte", tipo: "EFECTIVO" as const, esBoveda: true, saldoCentavos: 1, ...x });
    expect(planDeApertura([p({ tipo: "DIGITAL" })], EXISTENTES, [])[0].tipo).toBe("conflicto");
    expect(planDeApertura([p({})], [{ ...EXISTENTES[1], isActive: false }], [])[0].tipo).toBe("conflicto");
    expect(planDeApertura([p({ saldoCentavos: -1 })], EXISTENTES, [])[0].tipo).toBe("conflicto");
  });
});

describe("leerPedidoApertura", () => {
  it("lee el archivo de cuentas: saldo en pesos o null", () => {
    const r = leerPedidoApertura({
      fecha: "2026-10-16",
      cuentas: [
        { nombre: "Mercado Pago", tipo: "DIGITAL", saldo: 0 },
        { nombre: "Caja fuerte", tipo: "EFECTIVO", esBoveda: true, saldo: null },
        { nombre: "Mostrador", tipo: "EFECTIVO", saldo: 1234.5, tambien: ["Caja diaria"] },
      ],
    });
    expect(r).toEqual({
      ok: true,
      fecha: "2026-10-16",
      cuentas: [
        { nombre: "Mercado Pago", tipo: "DIGITAL", esBoveda: false, saldoCentavos: 0, tambien: [] },
        { nombre: "Caja fuerte", tipo: "EFECTIVO", esBoveda: true, saldoCentavos: null, tambien: [] },
        { nombre: "Mostrador", tipo: "EFECTIVO", esBoveda: false, saldoCentavos: 123_450, tambien: ["Caja diaria"] },
      ],
    });
  });

  it("rechaza fechas o tipos inválidos", () => {
    expect(leerPedidoApertura({ fecha: "16/10/2026", cuentas: [] }).ok).toBe(false);
    expect(leerPedidoApertura({ fecha: "2026-10-16", cuentas: [{ nombre: "X", tipo: "BANCO", saldo: 1 }] }).ok).toBe(false);
  });
});
