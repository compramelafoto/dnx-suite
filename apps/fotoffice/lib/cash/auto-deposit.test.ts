import { describe, expect, it } from "vitest";
import { resolveDepositTarget } from "./auto-deposit";

const cuentas = [
  { id: "efectivo", name: "Efectivo", kind: "EFECTIVO", isDefault: true },
  { id: "mp", name: "Mercado Pago", kind: "DIGITAL", isDefault: false },
];
const categorias = [{ id: "cuotas", name: "Cuotas", kind: "INGRESO" }];

describe("resolveDepositTarget", () => {
  it("con Caja apagada no deposita, y no es un error", () => {
    const r = resolveDepositTarget({
      cashEnabled: false,
      paymentMethod: "EFECTIVO",
      accounts: cuentas,
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: false, reason: "El módulo de Caja no está habilitado." });
  });

  it("un cobro por Mercado Pago va a la cuenta digital", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "MERCADO_PAGO",
      accounts: cuentas,
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: true, accountId: "mp", categoryId: "cuotas" });
  });

  it("un cobro en efectivo va a la cuenta de efectivo", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "EFECTIVO",
      accounts: cuentas,
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: true, accountId: "efectivo", categoryId: "cuotas" });
  });

  it("una transferencia va a la cuenta digital, no al efectivo", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "TRANSFERENCIA",
      accounts: cuentas,
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r.ok && r.accountId).toBe("mp");
  });

  it("sin la categoría esperada deposita igual, sin categoría", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "EFECTIVO",
      accounts: cuentas,
      categories: [],
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: true, accountId: "efectivo", categoryId: null });
  });

  it("sin ninguna cuenta no deposita en vez de inventar una", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "EFECTIVO",
      accounts: [],
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: false, reason: "El workspace no tiene ninguna cuenta de caja." });
  });

  it("sin cuenta digital, un cobro por Mercado Pago cae en la cuenta por omisión", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "MERCADO_PAGO",
      accounts: [{ id: "efectivo", name: "Efectivo", kind: "EFECTIVO", isDefault: true }],
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r.ok && r.accountId).toBe("efectivo");
  });
});
