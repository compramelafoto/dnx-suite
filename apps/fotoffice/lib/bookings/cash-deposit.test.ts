import { beforeEach, describe, expect, it, vi } from "vitest";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";

/**
 * Prueba el escenario que motivó el hallazgo crítico de la Tarea 12: si Caja está apagada
 * para el workspace, el depósito tiene que cortar ANTES de tocar `cashAccount`/`cashCategory`.
 *
 * Por qué importa de verdad: esas dos tablas las trae una migración que en este repo se aplica
 * a mano, después del deploy del código. Acá se simula justo esa ventana — las tablas "no
 * existen" (el doble de `tx` lanza si se las toca) — para probar que un workspace con Caja
 * apagada nunca llega a rozarlas, sin depender de tener una base real desalineada a mano.
 *
 * Desde la Tarea 15 este archivo también prueba el agujero que motivó el módulo Clientes: un
 * no socio que paga tiene que quedar con una ficha de `Client`, y eso tiene que pasar (o no
 * pasar) según el módulo Clientes, con total independencia de Caja.
 */
const isModuleEnabledForWorkspace = vi.fn();
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace }));

const recordCashMovement = vi.fn();
vi.mock("@/lib/cash/record-movement", () => ({ recordCashMovement }));

const findOrCreateClient = vi.fn();
vi.mock("@/lib/clients/find-or-create", () => ({ findOrCreateClient }));

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

// Habilita/deshabilita cada módulo por separado: son dos toggles independientes, y varias
// pruebas necesitan combinaciones distintas (Caja sí/Clientes no, y viceversa).
function moduleState(state: { cash?: boolean; clients?: boolean }) {
  isModuleEnabledForWorkspace.mockImplementation(async (_workspaceId: string, moduleKey: string) => {
    if (moduleKey === CASH_MODULE_KEY) return state.cash ?? false;
    if (moduleKey === CLIENTS_MODULE_KEY) return state.clients ?? false;
    return false;
  });
}

const inputBase = {
  workspaceId: "ws1",
  bookingId: "b1",
  memberId: null as string | null,
  contactName: "Ana Gómez",
  contactEmail: "ana@example.com",
  contactPhone: "341 555-0000",
  spaceName: "Estudio",
  amountMinor: 10_000,
  occurredAt: new Date("2026-09-13T12:00:00Z"),
  paymentMethod: "TRANSFERENCIA" as const,
};

beforeEach(() => {
  isModuleEnabledForWorkspace.mockReset();
  recordCashMovement.mockReset();
  findOrCreateClient.mockReset();
});

describe("depositBookingPayment — Caja apagada o sin migrar", () => {
  it("con el módulo apagado no toca cashAccount ni cashCategory, aunque esas tablas no existan", async () => {
    moduleState({ cash: false, clients: false });
    const tx = fakeTx();

    await expect(depositBookingPayment(tx as never, inputBase)).resolves.toBeUndefined();

    expect(tx.cashAccount.findMany).not.toHaveBeenCalled();
    expect(tx.cashCategory.findMany).not.toHaveBeenCalled();
    expect(recordCashMovement).not.toHaveBeenCalled();
  });

  it("con Caja encendida sí consulta cuentas y categorías", async () => {
    moduleState({ cash: true, clients: false });
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
  it("avisa por qué reserva y por qué no depositó, y tampoco toca Caja ni Clientes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    moduleState({ cash: true, clients: true });
    const tx = fakeTx();

    await depositBookingPayment(tx as never, { ...inputBase, bookingId: "b2", amountMinor: 0 });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("no se deposita en Caja"),
      expect.objectContaining({ bookingId: "b2", amountMinor: 0 }),
    );
    expect(tx.cashAccount.findMany).not.toHaveBeenCalled();
    expect(isModuleEnabledForWorkspace).not.toHaveBeenCalled();
    // Sin pago no hay compra: una reserva "pagada" con importe 0 tampoco da de alta un cliente.
    expect(findOrCreateClient).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe("depositBookingPayment — cliente de una reserva de socio", () => {
  it("conserva el comportamiento de hoy: usa la ficha ya enlazada al socio, sin pasar por findOrCreateClient", async () => {
    moduleState({ cash: true, clients: true });
    const tx = {
      cashAccount: { findMany: vi.fn(async () => [{ id: "acc1", name: "Caja chica", kind: "EFECTIVO", isDefault: true, isVault: false }]) },
      cashCategory: { findMany: vi.fn(async () => [{ id: "cat1", name: "Alquiler de espacios", kind: "INGRESO" }]) },
      client: { findUnique: vi.fn(async () => ({ id: "client-socio-1" })) },
    };

    await depositBookingPayment(tx as never, { ...inputBase, memberId: "member1" });

    expect(tx.client.findUnique).toHaveBeenCalledWith({
      where: { memberId: "member1" },
      select: { id: true },
    });
    expect(findOrCreateClient).not.toHaveBeenCalled();
    expect(recordCashMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clientId: "client-socio-1" }),
    );
  });
});

describe("depositBookingPayment — cliente de una reserva de no socio", () => {
  it("con Clientes encendido busca o crea la ficha a partir de los datos de contacto", async () => {
    moduleState({ cash: true, clients: true });
    findOrCreateClient.mockResolvedValue({ id: "client-nuevo-1", created: true });
    const tx = {
      cashAccount: { findMany: vi.fn(async () => [{ id: "acc1", name: "Caja chica", kind: "EFECTIVO", isDefault: true, isVault: false }]) },
      cashCategory: { findMany: vi.fn(async () => [{ id: "cat1", name: "Alquiler de espacios", kind: "INGRESO" }]) },
      client: { findUnique: vi.fn(async () => null) },
    };

    await depositBookingPayment(tx as never, {
      ...inputBase,
      memberId: null,
      contactName: "María José Fernández Luna",
      contactEmail: "mj@example.com",
      contactPhone: "341 555-1234",
    });

    // El primer nombre a `firstName`, y TODO el resto —compuesto o no— a `lastName`: es la
    // decisión explícita de `splitContactName`, ver su comentario en `cash-deposit.ts`.
    expect(findOrCreateClient).toHaveBeenCalledWith(tx, {
      workspaceId: "ws1",
      email: "mj@example.com",
      phone: "341 555-1234",
      firstName: "María",
      lastName: "José Fernández Luna",
    });
    expect(recordCashMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clientId: "client-nuevo-1" }),
    );
  });

  it("con un solo nombre deja el apellido en null, no en string vacío", async () => {
    moduleState({ cash: false, clients: true });
    findOrCreateClient.mockResolvedValue({ id: "client-nuevo-2", created: true });
    const tx = fakeTx();

    await depositBookingPayment(tx as never, {
      ...inputBase,
      bookingId: "b3",
      memberId: null,
      contactName: "Solange",
      contactPhone: null,
    });

    expect(findOrCreateClient).toHaveBeenCalledWith(tx, {
      workspaceId: "ws1",
      email: "ana@example.com",
      phone: null,
      firstName: "Solange",
      lastName: null,
    });
  });

  it("con el módulo Clientes apagado no crea nada y el cobro sigue funcionando igual", async () => {
    moduleState({ cash: true, clients: false });
    const tx = {
      cashAccount: { findMany: vi.fn(async () => [{ id: "acc1", name: "Caja chica", kind: "EFECTIVO", isDefault: true, isVault: false }]) },
      cashCategory: { findMany: vi.fn(async () => [{ id: "cat1", name: "Alquiler de espacios", kind: "INGRESO" }]) },
      client: { findUnique: vi.fn(async () => null) },
    };

    await depositBookingPayment(tx as never, { ...inputBase, memberId: null });

    expect(findOrCreateClient).not.toHaveBeenCalled();
    // El cobro (el depósito en Caja) sigue andando aunque no haya ficha de cliente.
    expect(recordCashMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clientId: null }),
    );
  });

  it("normaliza espacios de más antes de partir el nombre en firstName/lastName", async () => {
    moduleState({ cash: false, clients: true });
    findOrCreateClient.mockResolvedValue({ id: "client-nuevo-3", created: true });
    const tx = fakeTx();

    await depositBookingPayment(tx as never, {
      ...inputBase,
      bookingId: "b4",
      memberId: null,
      contactName: "  Juan   Pérez  ",
    });

    expect(findOrCreateClient).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ firstName: "Juan", lastName: "Pérez" }),
    );
  });
});

describe("depositBookingPayment — reserva de SOCIO con Caja y Clientes apagados (regresión de la Tarea 15)", () => {
  // Este es el escenario que la Tarea 15 dejó sin cubrir: todas las pruebas de "módulos
  // apagados" usaban memberId: null, así que ninguna agarró que `resolveBookingClient` tocaba
  // `tx.client.findUnique` para el socio ANTES de preguntar si Clientes estaba habilitado.
  // `Client` es una tabla nueva que en este repo se aplica a mano después del deploy — acá se
  // simula esa ventana (el doble de `tx` lanza si se toca `client.findUnique`, igual que ya se
  // hace arriba con `cashAccount`/`cashCategory`) para probar que una reserva de socio con los
  // dos módulos apagados nunca la roza, y que el cobro se completa igual (la función resuelve
  // sin lanzar, en vez de reventar la transacción del llamador).
  it("no toca `Client` para el socio y el cobro se completa igual", async () => {
    moduleState({ cash: false, clients: false });
    const tx = {
      cashAccount: { findMany: tablaAusente("cash_account") },
      cashCategory: { findMany: tablaAusente("cash_category") },
      client: { findUnique: tablaAusente("Client") },
    };

    await expect(
      depositBookingPayment(tx as never, { ...inputBase, memberId: "member1" }),
    ).resolves.toBeUndefined();

    expect(tx.client.findUnique).not.toHaveBeenCalled();
    expect(findOrCreateClient).not.toHaveBeenCalled();
    expect(recordCashMovement).not.toHaveBeenCalled();
  });
});
