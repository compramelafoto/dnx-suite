import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prueba el escenario que motivó el hallazgo crítico de la Tarea 12: si Caja está apagada
 * para el workspace, el depósito tiene que cortar ANTES de tocar `cashAccount`/`cashCategory`.
 *
 * Por qué importa de verdad: esas dos tablas las trae una migración que en este repo se aplica
 * a mano, después del deploy del código. Acá se simula justo esa ventana — las tablas "no
 * existen" (el doble de `tx` lanza si se las toca) — para probar que un workspace con Caja
 * apagada nunca llega a rozarlas, sin depender de tener una base real desalineada a mano.
 */
const isModuleEnabledForWorkspace = vi.fn();
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace }));

const recordCashMovement = vi.fn();
vi.mock("@/lib/cash/record-movement", () => ({ recordCashMovement }));

const { depositBookingPayment } = await import("./cash-deposit");

function tablaAusente(nombre: string) {
  return vi.fn(async () => {
    throw new Error(`relation "${nombre}" does not exist`);
  });
}

function fakeTx() {
  return {
    cashAccount: { findMany: tablaAusente("cash_account") },
    cashCategory: { findMany: tablaAusente("cash_category") },
    client: { findUnique: vi.fn(async () => null) },
  };
}

const inputBase = {
  workspaceId: "ws1",
  bookingId: "b1",
  memberId: null as string | null,
  spaceName: "Estudio",
  amountMinor: 10_000,
  occurredAt: new Date("2026-09-13T12:00:00Z"),
  paymentMethod: "TRANSFERENCIA" as const,
};

beforeEach(() => {
  isModuleEnabledForWorkspace.mockReset();
  recordCashMovement.mockReset();
});

describe("depositBookingPayment — Caja apagada o sin migrar", () => {
  it("con el módulo apagado no toca cashAccount ni cashCategory, aunque esas tablas no existan", async () => {
    isModuleEnabledForWorkspace.mockResolvedValue(false);
    const tx = fakeTx();

    await expect(depositBookingPayment(tx as never, inputBase)).resolves.toBeUndefined();

    expect(tx.cashAccount.findMany).not.toHaveBeenCalled();
    expect(tx.cashCategory.findMany).not.toHaveBeenCalled();
    expect(recordCashMovement).not.toHaveBeenCalled();
  });

  it("con Caja encendida sí consulta cuentas y categorías", async () => {
    isModuleEnabledForWorkspace.mockResolvedValue(true);
    const tx = {
      cashAccount: { findMany: vi.fn(async () => []) },
      cashCategory: { findMany: vi.fn(async () => []) },
      client: { findUnique: vi.fn(async () => null) },
    };

    await depositBookingPayment(tx as never, inputBase);

    expect(tx.cashAccount.findMany).toHaveBeenCalledTimes(1);
    expect(tx.cashCategory.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("depositBookingPayment — importe <= 0", () => {
  it("avisa por qué reserva y por qué no depositó, y tampoco toca Caja", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    isModuleEnabledForWorkspace.mockResolvedValue(true);
    const tx = fakeTx();

    await depositBookingPayment(tx as never, { ...inputBase, bookingId: "b2", amountMinor: 0 });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("no se deposita en Caja"),
      expect.objectContaining({ bookingId: "b2", amountMinor: 0 }),
    );
    expect(tx.cashAccount.findMany).not.toHaveBeenCalled();
    expect(isModuleEnabledForWorkspace).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
