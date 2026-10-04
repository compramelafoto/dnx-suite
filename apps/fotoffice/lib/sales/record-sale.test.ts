import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import type { RecordSaleInput } from "./record-sale";

/**
 * `record-sale.ts` es la pieza más riesgosa de todo el módulo Ventas —mueve plata y stock a
 * la vez— y hasta esta prueba no tenía ni una. El revisor de la Tarea 7 lo demostró moviendo
 * la guarda de Caja de `depositarEnCaja` DESPUÉS de la consulta a `cashAccount`: reintrodujo
 * textualmente el error que ya costó dos incidentes en este proyecto (Tarea 12 y Tarea 15,
 * ver `lib/bookings/cash-deposit.test.ts`) y la batería completa siguió en verde.
 *
 * El molde es el mismo que ese archivo: un `tx` falso cuyas tablas de Caja y de `Client`
 * LANZAN si alguien las toca (simulando la ventana en la que la migración todavía no corrió),
 * para probar que un módulo apagado ni siquiera intenta consultarlas — no alcanza con que el
 * resultado final "dé bien", porque un error ahí adentro revienta la transacción entera de la
 * venta.
 */
const isModuleEnabledForWorkspace = vi.fn();
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace }));

const recordCashMovement = vi.fn();
vi.mock("@/lib/cash/record-movement", () => ({ recordCashMovement }));

const findOrCreateClient = vi.fn();
vi.mock("@/lib/clients/find-or-create", () => ({ findOrCreateClient }));

const { recordSale } = await import("./record-sale");

function tablaAusente(nombre: string) {
  return vi.fn(async () => {
    throw new Error(`relation "${nombre}" does not exist`);
  });
}

/**
 * Un `tx` falso que arma una venta "en memoria", sin Postgres.
 *
 * Por omisión, `Client`/`cashAccount`/`cashCategory` "no existen" (lanzan si se tocan) —igual
 * que en `cash-deposit.test.ts`— porque la mayoría de las pruebas de acá abajo necesitan
 * probar justamente que con el módulo correspondiente apagado esas tablas ni se rozan. Las
 * pruebas que sí encienden un módulo pisan esos campos con `over`.
 */
function saleTx(over: Record<string, unknown> = {}) {
  return {
    sale: {
      findFirst: vi.fn(async () => null),
      createMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(
        async ({ where }: { where: { workspaceId_saleNumber: { saleNumber: number } } }) => ({
          id: "sale1",
          saleNumber: where.workspaceId_saleNumber.saleNumber,
        }),
      ),
      update: vi.fn(async () => ({})),
    },
    saleItem: { createMany: vi.fn(async () => ({ count: 1 })) },
    product: { findMany: vi.fn(async () => []), update: vi.fn(async () => ({})) },
    stockMovement: { create: vi.fn(async () => ({})) },
    client: { count: tablaAusente("Client") },
    cashAccount: { findMany: tablaAusente("cash_account") },
    cashCategory: { findMany: tablaAusente("cash_category") },
    ...over,
  };
}

// Habilita/deshabilita cada módulo por separado, igual que en cash-deposit.test.ts: Caja y
// Clientes son dos toggles independientes.
function moduleState(state: { cash?: boolean; clients?: boolean }) {
  isModuleEnabledForWorkspace.mockImplementation(async (_workspaceId: string, moduleKey: string) => {
    if (moduleKey === CASH_MODULE_KEY) return state.cash ?? false;
    if (moduleKey === CLIENTS_MODULE_KEY) return state.clients ?? false;
    return false;
  });
}

const inputBase: RecordSaleInput = {
  workspaceId: "ws1",
  createdByUserId: 7,
  occurredAt: new Date("2026-09-14T12:00:00Z"),
  paymentMethod: "EFECTIVO",
  discountMinor: 0,
  note: null,
  client: { mode: "none" },
  lines: [
    {
      productId: "p1",
      description: "Rollo de fotos",
      qty: 2,
      unitPriceMinor: 1_000_00,
      unitCostMinor: 500_00,
      priceWasOverridden: false,
    },
  ],
};

// `depositarEnCaja` avisa por `console.warn` cuando no deposita (Caja apagada, o sin destino
// configurado). Se silencia por omisión para no ensuciar la salida de las pruebas que no lo
// necesitan; las que sí lo verifican leen `warnSpy` directamente.
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  isModuleEnabledForWorkspace.mockReset();
  recordCashMovement.mockReset();
  findOrCreateClient.mockReset();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("recordSale — Caja apagada", () => {
  it("no toca cashAccount ni cashCategory, avisa por consola, y la venta se completa igual", async () => {
    moduleState({ cash: false, clients: false });
    const tx = saleTx();

    const resultado = await recordSale(tx as never, inputBase);

    expect(resultado).toEqual({ saleId: "sale1", saleNumber: 1, deposited: false });
    expect(tx.cashAccount.findMany).not.toHaveBeenCalled();
    expect(tx.cashCategory.findMany).not.toHaveBeenCalled();
    expect(recordCashMovement).not.toHaveBeenCalled();
    expect(tx.sale.update).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Caja apagada"),
      expect.objectContaining({ saleId: "sale1", saleNumber: 1 }),
    );
  });
});

describe("recordSale — Clientes apagado", () => {
  it("con un clientId existente no toca Client, y la venta se completa igual", async () => {
    moduleState({ cash: false, clients: false });
    const tx = saleTx();
    const input: RecordSaleInput = { ...inputBase, client: { mode: "existing", clientId: "c1" } };

    const resultado = await recordSale(tx as never, input);

    expect(resultado.saleId).toBe("sale1");
    expect(tx.client.count).not.toHaveBeenCalled();
    expect(findOrCreateClient).not.toHaveBeenCalled();
  });

  it("con un cliente nuevo tampoco llama a findOrCreateClient", async () => {
    moduleState({ cash: false, clients: false });
    const tx = saleTx();
    const input: RecordSaleInput = {
      ...inputBase,
      client: { mode: "new", firstName: "Ana", lastName: null, phone: null, email: null },
    };

    const resultado = await recordSale(tx as never, input);

    expect(resultado.saleId).toBe("sale1");
    expect(findOrCreateClient).not.toHaveBeenCalled();
  });
});

describe("recordSale — todo encendido", () => {
  it("deposita el total en Caja y descuenta el stock del producto vendido", async () => {
    moduleState({ cash: true, clients: true });
    recordCashMovement.mockResolvedValue({ id: "mov1", created: true });
    const tx = saleTx({
      client: { count: vi.fn(async () => 1) },
      cashAccount: {
        findMany: vi.fn(async () => [
          { id: "acc1", name: "Caja chica", kind: "EFECTIVO", isDefault: true, isVault: false },
        ]),
      },
      cashCategory: { findMany: vi.fn(async () => [{ id: "cat1", name: "Ventas", kind: "INGRESO" }]) },
      product: {
        findMany: vi.fn(async () => [{ id: "p1", tracksStock: true }]),
        update: vi.fn(async () => ({})),
      },
    });
    const input: RecordSaleInput = { ...inputBase, client: { mode: "existing", clientId: "c1" } };

    const resultado = await recordSale(tx as never, input);

    expect(resultado).toEqual({ saleId: "sale1", saleNumber: 1, deposited: true });
    expect(recordCashMovement).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        amountMinor: 2_000_00,
        clientId: "c1",
        sourceModule: "sales",
        sourceRef: "sale1",
        accountId: "acc1",
        categoryId: "cat1",
      }),
    );
    expect(tx.sale.update).toHaveBeenCalledWith({ where: { id: "sale1" }, data: { cashMovementId: "mov1" } });
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productId: "p1", qty: -2, reason: "VENTA", sourceRef: "sale1" }),
      }),
    );
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { stockQty: { decrement: 2 } } });
  });
});

describe("recordSale — Caja encendida pero sin cuenta configurada", () => {
  it("no deposita, avisa por consola con el motivo, y la venta se completa igual", async () => {
    moduleState({ cash: true, clients: false });
    const tx = saleTx({
      cashAccount: { findMany: vi.fn(async () => []) },
      cashCategory: { findMany: vi.fn(async () => []) },
    });

    const resultado = await recordSale(tx as never, inputBase);

    expect(resultado.deposited).toBe(false);
    expect(recordCashMovement).not.toHaveBeenCalled();
    expect(tx.sale.update).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("sin destino configurado"),
      expect.objectContaining({ motivo: expect.any(String) }),
    );
  });
});

describe("recordSale — el correlativo se recalcula en el reintento", () => {
  it("si createMany choca (count 0), relee el último número y reintenta con el siguiente", async () => {
    moduleState({ cash: false, clients: false });
    let llamadas = 0;
    const tx = saleTx({
      sale: {
        findFirst: vi.fn(async () => (llamadas === 0 ? { saleNumber: 5 } : { saleNumber: 6 })),
        createMany: vi.fn(async () => {
          llamadas += 1;
          // El primer intento (número 6) choca con otra caja; el segundo (número 7) gana.
          return llamadas === 1 ? { count: 0 } : { count: 1 };
        }),
        findUniqueOrThrow: vi.fn(
          async ({ where }: { where: { workspaceId_saleNumber: { saleNumber: number } } }) => ({
            id: "sale1",
            saleNumber: where.workspaceId_saleNumber.saleNumber,
          }),
        ),
        update: vi.fn(async () => ({})),
      },
    });

    const resultado = await recordSale(tx as never, inputBase);

    expect(tx.sale.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.sale.createMany).toHaveBeenCalledTimes(2);
    expect(resultado.saleNumber).toBe(7);
  });

  it("si los tres intentos chocan, lanza en vez de crear una venta sin número", async () => {
    moduleState({ cash: false, clients: false });
    const tx = saleTx({
      sale: {
        findFirst: vi.fn(async () => null),
        createMany: vi.fn(async () => ({ count: 0 })),
        findUniqueOrThrow: vi.fn(async () => {
          throw new Error("no debería llegar a releer: ningún intento ganó la carrera");
        }),
        update: vi.fn(async () => ({})),
      },
    });

    await expect(recordSale(tx as never, inputBase)).rejects.toThrow(
      "No se pudo asignar un número de venta después de tres intentos.",
    );
    expect(tx.sale.createMany).toHaveBeenCalledTimes(3);
  });
});

describe("recordSale — stock", () => {
  it("un producto que no controla existencia no genera StockMovement ni descuenta", async () => {
    moduleState({ cash: false, clients: false });
    const tx = saleTx({
      product: {
        findMany: vi.fn(async () => [{ id: "p1", tracksStock: false }]),
        update: vi.fn(async () => ({})),
      },
    });

    await recordSale(tx as never, inputBase);

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("un producto que no aparece en la relectura por workspace (de otro negocio) no descuenta nada", async () => {
    // `checkoutAction` ya filtra esto antes de llegar acá (buildTicketLines rechaza el
    // ticket entero), pero `descontarStock` tiene su propia relectura por `workspaceId` y no
    // depende de esa capa: un id que no vuelve en `product.findMany` queda afuera sin romper
    // la venta.
    moduleState({ cash: false, clients: false });
    const tx = saleTx({ product: { findMany: vi.fn(async () => []), update: vi.fn(async () => ({})) } });
    const input: RecordSaleInput = {
      ...inputBase,
      lines: [{ ...inputBase.lines[0], productId: "ajeno" }],
    };

    await recordSale(tx as never, input);

    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("descuenta la cantidad íntegra sin verificar que alcance: el stock puede quedar negativo", async () => {
    // §regla 2 del módulo: vender nunca se bloquea por falta de stock. `descontarStock` no lee
    // `stockQty` en ningún momento —sólo `tracksStock`—, así que no hay forma de que compare
    // contra la existencia disponible antes de restar.
    moduleState({ cash: false, clients: false });
    const tx = saleTx({
      product: {
        findMany: vi.fn(async () => [{ id: "p1", tracksStock: true }]),
        update: vi.fn(async () => ({})),
      },
    });
    const input: RecordSaleInput = { ...inputBase, lines: [{ ...inputBase.lines[0], qty: 500 }] };

    await recordSale(tx as never, input);

    expect(tx.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, tracksStock: true } }),
    );
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { stockQty: { decrement: 500 } } });
  });
});
