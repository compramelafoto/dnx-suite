import { describe, expect, it } from "vitest";
import { resolveDepositTarget } from "./auto-deposit";

const cuentas = [
  { id: "efectivo", name: "Efectivo", kind: "EFECTIVO", isDefault: true, isVault: false },
  { id: "mp", name: "Mercado Pago", kind: "DIGITAL", isDefault: false, isVault: false },
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
      accounts: [{ id: "efectivo", name: "Efectivo", kind: "EFECTIVO", isDefault: true, isVault: false }],
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r.ok && r.accountId).toBe("efectivo");
  });

  describe("nunca cae en la caja fuerte", () => {
    it("un cobro en efectivo no elige la caja fuerte ni siquiera como último recurso", () => {
      // El caso de I5: si desactivan o reordenan la caja diaria y sólo queda la caja fuerte
      // como cuenta EFECTIVO, el cobro tiene que caer en cualquier otra cuenta que exista
      // —acá, la digital— antes que en la caja fuerte: nadie la arquea a diario y su saldo
      // quedaría inflado contra plata que en realidad está en el mostrador.
      const r = resolveDepositTarget({
        cashEnabled: true,
        paymentMethod: "EFECTIVO",
        accounts: [
          { id: "fuerte", name: "Caja fuerte", kind: "EFECTIVO", isDefault: false, isVault: true },
          { id: "mp", name: "Mercado Pago", kind: "DIGITAL", isDefault: false, isVault: false },
        ],
        categories: categorias,
        categoryName: "Cuotas",
      });
      expect(r.ok && r.accountId).toBe("mp");
    });

    it("con caja diaria Y caja fuerte, el efectivo va a la diaria", () => {
      const r = resolveDepositTarget({
        cashEnabled: true,
        paymentMethod: "EFECTIVO",
        accounts: [
          { id: "fuerte", name: "Caja fuerte", kind: "EFECTIVO", isDefault: false, isVault: true },
          { id: "efectivo", name: "Caja diaria", kind: "EFECTIVO", isDefault: true, isVault: false },
        ],
        categories: categorias,
        categoryName: "Cuotas",
      });
      expect(r).toEqual({ ok: true, accountId: "efectivo", categoryId: "cuotas" });
    });

    it("la caja fuerte marcada como cuenta por omisión tampoco se usa como respaldo", () => {
      // Si alguien deja la caja fuerte como `isDefault` por error de configuración, el
      // respaldo de "ninguna cuenta del tipo pedido" tampoco puede elegirla.
      const r = resolveDepositTarget({
        cashEnabled: true,
        paymentMethod: "MERCADO_PAGO",
        accounts: [{ id: "fuerte", name: "Caja fuerte", kind: "EFECTIVO", isDefault: true, isVault: true }],
        categories: categorias,
        categoryName: "Cuotas",
      });
      expect(r).toEqual({
        ok: false,
        reason: "El workspace no tiene ninguna cuenta de caja que no sea la caja fuerte.",
      });
    });
  });
});
