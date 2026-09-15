import { beforeEach, describe, expect, it, vi } from "vitest";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import type { VoidSaleInput } from "./void-sale";

/**
 * `void-sale.ts` es el espejo de `record-sale.ts`, y hereda su riesgo: mueve plata y stock a
 * la vez, ahora en sentido contrario. El molde de prueba es el mismo que
 * `record-sale.test.ts` — un `tx` falso cuyas tablas de Caja LANZAN por omisión (simulando la
 * ventana en la que Caja está apagada), para probar que la guarda de
 * `isModuleEnabledForWorkspace` corta ANTES de tocarlas, no después.
 *
 * `buildReversal` NO se mockea: es la pieza que este archivo tiene la obligación de reusar
 * (§regla 3 de la Tarea 9), así que las pruebas de acá abajo verifican el comportamiento real
 * de la combinación, no una promesa de que se la llamó.
 */
const isModuleEnabledForWorkspace = vi.fn();
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace }));

const { voidSale } = await import("./void-sale");

function tablaAusente(nombre: string) {
  return vi.fn(async () => {
    throw new Error(`relation "${nombre}" does not exist`);
  });
}

/**
 * Un `tx` falso que "anula" una venta en memoria, sin Postgres.
 *
 * Por omisión la venta es una `COMPLETADA` sin cliente ni depósito (`cashMovementId: null`),
 * sin renglones, y las tablas de Caja "no existen" (lanzan si se tocan) —igual que en
 * `record-sale.test.ts`— porque la mayoría de las pruebas necesitan probar justamente que con
 * Caja apagada, o sin depósito que revertir, esas tablas ni se rozan.
 */
function voidTx(over: {
  sale?: Partial<{
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  }>;
  saleItem?: Partial<{ findMany: ReturnType<typeof vi.fn> }>;
  product?: Partial<{ findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }>;
  stockMovement?: Partial<{ create: ReturnType<typeof vi.fn> }>;
  cashMovement?: Partial<{ findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }>;
  cashShift?: Partial<{ findFirst: ReturnType<typeof vi.fn> }>;
} = {}) {
  return {
    sale: {
      findFirst: vi.fn(async () => ({
        id: "sale1",
        saleNumber: 5,
        status: "COMPLETADA",
        cashMovementId: null,
      })),
      update: vi.fn(async () => ({})),
      ...over.sale,
    },
    saleItem: { findMany: vi.fn(async () => []), ...over.saleItem },
    product: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
      ...over.product,
    },
    stockMovement: { create: vi.fn(async () => ({})), ...over.stockMovement },
    cashMovement: {
      findFirst: tablaAusente("cash_movement"),
      create: tablaAusente("cash_movement"),
      ...over.cashMovement,
    },
    cashShift: { findFirst: tablaAusente("cash_shift"), ...over.cashShift },
  };
}

const inputBase: VoidSaleInput = {
  workspaceId: "ws1",
  saleId: "sale1",
  reason: "El cliente se arrepintió",
  userId: 7,
};

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  isModuleEnabledForWorkspace.mockReset();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("voidSale — motivo", () => {
  it("un motivo en blanco no llega ni a leer la venta", async () => {
    const tx = voidTx();

    const resultado = await voidSale(tx as never, { ...inputBase, reason: "   " });

    expect(resultado).toEqual({ ok: false, error: "Escribí por qué se anula la venta." });
    expect(tx.sale.findFirst).not.toHaveBeenCalled();
  });
});

describe("voidSale — la venta no existe", () => {
  it("vuelve un error y no escribe nada", async () => {
    const tx = voidTx({ sale: { findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) } });

    const resultado = await voidSale(tx as never, inputBase);

    expect(resultado).toEqual({ ok: false, error: "Esa venta no existe." });
    expect(tx.sale.update).not.toHaveBeenCalled();
  });
});

describe("voidSale — una venta anulada no se vuelve a anular", () => {
  it("corta antes de tocar el stock o Caja", async () => {
    const tx = voidTx({
      sale: {
        findFirst: vi.fn(async () => ({
          id: "sale1",
          saleNumber: 5,
          status: "ANULADA",
          cashMovementId: "mov1",
        })),
        update: vi.fn(async () => ({})),
      },
    });

    const resultado = await voidSale(tx as never, inputBase);

    expect(resultado).toEqual({ ok: false, error: "Esa venta ya está anulada." });
    expect(tx.saleItem.findMany).not.toHaveBeenCalled();
    expect(isModuleEnabledForWorkspace).not.toHaveBeenCalled();
    expect(tx.sale.update).not.toHaveBeenCalled();
  });
});

describe("voidSale — la venta nunca depositó", () => {
  it("con cashMovementId nulo no pregunta por Caja, y anula igual", async () => {
    const tx = voidTx();

    const resultado = await voidSale(tx as never, inputBase);

    expect(resultado).toEqual({ ok: true, saleNumber: 5 });
    expect(isModuleEnabledForWorkspace).not.toHaveBeenCalled();
    expect(tx.sale.update).toHaveBeenCalledWith({
      where: { id: "sale1" },
      data: {
        status: "ANULADA",
        voidedAt: expect.any(Date),
        voidedByUserId: 7,
        voidReason: "El cliente se arrepintió",
      },
    });
  });
});

describe("voidSale — Caja apagada", () => {
  it("con depósito pero el módulo apagado, no toca cashMovement ni cashShift, avisa, y anula igual", async () => {
    isModuleEnabledForWorkspace.mockResolvedValue(false);
    const tx = voidTx({
      sale: {
        findFirst: vi.fn(async () => ({
          id: "sale1",
          saleNumber: 5,
          status: "COMPLETADA",
          cashMovementId: "mov1",
        })),
        update: vi.fn(async () => ({})),
      },
    });

    const resultado = await voidSale(tx as never, inputBase);

    expect(resultado).toEqual({ ok: true, saleNumber: 5 });
    expect(isModuleEnabledForWorkspace).toHaveBeenCalledWith("ws1", CASH_MODULE_KEY);
    expect(tx.cashMovement.findFirst).not.toHaveBeenCalled();
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
    expect(tx.cashShift.findFirst).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Caja apagada"),
      expect.objectContaining({ saleId: "sale1", saleNumber: 5 }),
    );
    expect(tx.sale.update).toHaveBeenCalled();
  });
});

describe("voidSale — todo encendido, con depósito", () => {
  it("escribe el contramovimiento que arma buildReversal, con el turno abierto", async () => {
    isModuleEnabledForWorkspace.mockResolvedValue(true);
    const tx = voidTx({
      sale: {
        findFirst: vi.fn(async () => ({
          id: "sale1",
          saleNumber: 5,
          status: "COMPLETADA",
          cashMovementId: "mov1",
        })),
        update: vi.fn(async () => ({})),
      },
      cashMovement: {
        findFirst: vi.fn(async () => ({
          id: "mov1",
          kind: "INGRESO",
          amountArs: { toString: () => "2000.00" },
          accountId: "acc1",
          categoryId: "cat1",
          paymentMethod: "EFECTIVO",
          clientId: "c1",
          description: "Venta #5",
          reversedBy: null,
          transferId: null,
        })),
        create: vi.fn(async () => ({ id: "mov2" })),
      },
      cashShift: { findFirst: vi.fn(async () => ({ id: "shift1" })) },
    });

    const resultado = await voidSale(tx as never, inputBase);

    expect(resultado).toEqual({ ok: true, saleNumber: 5 });
    expect(tx.cashMovement.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws1",
        accountId: "acc1",
        shiftId: "shift1",
        kind: "EGRESO",
        amountArs: "2000.00",
        occurredAt: expect.any(Date),
        categoryId: "cat1",
        paymentMethod: "EFECTIVO",
        clientId: "c1",
        description: "Anulación de: Venta #5",
        sourceModule: "manual",
        sourceRef: null,
        reversesMovementId: "mov1",
        reverseReason: "El cliente se arrepintió",
        transferId: null,
        createdByUserId: 7,
      },
    });
  });
});

describe("voidSale — el contramovimiento ya estaba anulado a mano", () => {
  it("anula la venta y devuelve el stock igual, sin duplicar el contramovimiento", async () => {
    isModuleEnabledForWorkspace.mockResolvedValue(true);
    const tx = voidTx({
      sale: {
        findFirst: vi.fn(async () => ({
          id: "sale1",
          saleNumber: 5,
          status: "COMPLETADA",
          cashMovementId: "mov1",
        })),
        update: vi.fn(async () => ({})),
      },
      saleItem: {
        findMany: vi.fn(async () => [{ productId: "p1", qty: 2 }]),
      },
      product: {
        findMany: vi.fn(async () => [{ id: "p1", tracksStock: true }]),
        update: vi.fn(async () => ({})),
      },
      cashMovement: {
        findFirst: vi.fn(async () => ({
          id: "mov1",
          kind: "INGRESO",
          amountArs: { toString: () => "2000.00" },
          accountId: "acc1",
          categoryId: "cat1",
          paymentMethod: "EFECTIVO",
          clientId: null,
          description: "Venta #5",
          reversedBy: { id: "otro-mov" },
          transferId: null,
        })),
        create: vi.fn(async () => ({})),
      },
    });

    const resultado = await voidSale(tx as never, inputBase);

    // El dinero ya volvió a mano (alguien anuló el asiento desde /caja/movimientos): abortar
    // acá dejaría la venta COMPLETADA para siempre con Caja ya diciendo lo contrario. Por eso
    // la venta se anula igual, el stock vuelve, y sólo se saltea el contramovimiento porque
    // escribir uno segundo duplicaría la devolución de plata.
    expect(resultado).toEqual({ ok: true, saleNumber: 5 });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws1",
        productId: "p1",
        qty: 2,
        reason: "DEVOLUCION",
        sourceModule: "sales",
        sourceRef: "sale1",
        createdByUserId: 7,
      },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { stockQty: { increment: 2 } },
    });
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
    expect(tx.sale.update).toHaveBeenCalledWith({
      where: { id: "sale1" },
      data: {
        status: "ANULADA",
        voidedAt: expect.any(Date),
        voidedByUserId: 7,
        voidReason: "El cliente se arrepintió",
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Caja ya tenía el contramovimiento hecho a mano"),
      expect.objectContaining({ saleId: "sale1", saleNumber: 5, cashMovementId: "mov1" }),
    );
  });

  it("el resto de los rechazos de buildReversal (una pata de un pase) sigue abortando", async () => {
    isModuleEnabledForWorkspace.mockResolvedValue(true);
    const tx = voidTx({
      sale: {
        findFirst: vi.fn(async () => ({
          id: "sale1",
          saleNumber: 5,
          status: "COMPLETADA",
          cashMovementId: "mov1",
        })),
        update: vi.fn(async () => ({})),
      },
      cashMovement: {
        findFirst: vi.fn(async () => ({
          id: "mov1",
          kind: "INGRESO",
          amountArs: { toString: () => "2000.00" },
          accountId: "acc1",
          categoryId: "cat1",
          paymentMethod: "EFECTIVO",
          clientId: null,
          description: "Venta #5",
          reversedBy: null,
          transferId: "pase1",
        })),
        create: vi.fn(async () => ({})),
      },
    });

    const resultado = await voidSale(tx as never, inputBase);

    expect(resultado).toEqual({
      ok: false,
      error: "Ese movimiento es parte de un pase entre cuentas. Para deshacerlo, hacé el pase inverso.",
    });
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
    expect(tx.sale.update).not.toHaveBeenCalled();
  });
});

describe("voidSale — devolución de stock", () => {
  it("un renglón sin producto (suelto, a mano) no genera movimiento", async () => {
    const tx = voidTx({
      saleItem: { findMany: vi.fn(async () => [{ productId: null, qty: 3 }]) },
    });

    await voidSale(tx as never, inputBase);

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("un producto que no controla existencia no genera movimiento", async () => {
    const tx = voidTx({
      saleItem: { findMany: vi.fn(async () => [{ productId: "p1", qty: 2 }]) },
      product: {
        findMany: vi.fn(async () => [{ id: "p1", tracksStock: false }]),
        update: vi.fn(async () => ({})),
      },
    });

    await voidSale(tx as never, inputBase);

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("un producto que no vuelve en la relectura por workspace (ajeno) no se toca", async () => {
    const tx = voidTx({
      saleItem: { findMany: vi.fn(async () => [{ productId: "ajeno", qty: 2 }]) },
      product: { findMany: vi.fn(async () => []), update: vi.fn(async () => ({})) },
    });

    await voidSale(tx as never, inputBase);

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("devuelve la cantidad íntegra, positiva, con motivo DEVOLUCION", async () => {
    const tx = voidTx({
      saleItem: { findMany: vi.fn(async () => [{ productId: "p1", qty: 4 }]) },
      product: {
        findMany: vi.fn(async () => [{ id: "p1", tracksStock: true }]),
        update: vi.fn(async () => ({})),
      },
    });

    await voidSale(tx as never, inputBase);

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws1",
        productId: "p1",
        qty: 4,
        reason: "DEVOLUCION",
        sourceModule: "sales",
        sourceRef: "sale1",
        createdByUserId: 7,
      },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { stockQty: { increment: 4 } },
    });
  });
});
