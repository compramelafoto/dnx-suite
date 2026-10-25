import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/db", () => ({ prisma: {} }));

import type { PrismaClient } from "@repo/db";
import { aplicarApertura, leerEstadoApertura, MOTIVO_REEMPLAZO } from "./apertura-aplicar";
import type { PasoApertura } from "./apertura";

type Fila = Record<string, unknown>;

/** Una base de mentira: guarda lo que se crea y contesta las consultas que usa el comando. */
function baseFalsa(movimientos: Fila[] = [], cuentas: Fila[] = []) {
  const creados: Fila[] = [];
  const cuentasCreadas: Fila[] = [];
  const db = {
    cashAccount: {
      findMany: async () => cuentas,
      findFirst: async ({ where }: { where: Fila }) =>
        where.id ? (cuentas.find((c) => c.id === where.id) ?? null) : { order: 10 },
      create: async ({ data }: { data: Fila }) => {
        const c = { id: `nueva-${cuentasCreadas.length + 1}`, kind: data.kind };
        cuentasCreadas.push({ ...data, ...c });
        cuentas.push({ ...data, ...c });
        return c;
      },
    },
    cashMovement: {
      // Sólo la consulta de `openingBalancesByAccount`: saldos iniciales vigentes.
      findMany: async () => movimientos.filter((m) => m.sourceModule === "saldo-inicial" && m.kind === "INGRESO" && !m.reversesMovementId && !m.reversedBy),
      findFirst: async ({ where }: { where: Fila }) => movimientos.find((m) => m.id === where.id) ?? null,
      create: async ({ data }: { data: Fila }) => {
        creados.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => fn(db),
  };
  return { db: db as unknown as PrismaClient, creados, cuentasCreadas };
}

const SALDO_VIGENTE: Fila = {
  id: "m1",
  accountId: "a2",
  kind: "INGRESO",
  amountArs: "500000.00",
  occurredAt: new Date("2026-10-01T03:00:00Z"),
  categoryId: null,
  paymentMethod: "EFECTIVO",
  clientId: null,
  description: "Saldo inicial",
  transferId: null,
  sourceModule: "saldo-inicial",
  reversesMovementId: null,
  reversedBy: null,
};
const CAJA_FUERTE: Fila = { id: "a2", name: "Caja fuerte", kind: "EFECTIVO", isVault: true, isActive: true };
const OCURRIDO = new Date("2026-10-16T03:00:00Z");

describe("leerEstadoApertura", () => {
  it("lee el saldo inicial vigente de cada cuenta, el mismo que ve Configuración", async () => {
    const { db } = baseFalsa([SALDO_VIGENTE], [CAJA_FUERTE]);
    const estado = await leerEstadoApertura(db, "w");
    expect(estado.aperturas).toEqual([{ accountId: "a2", movementId: "m1", centavos: 500_000_00 }]);
  });
});

describe("aplicarApertura", () => {
  it("carga el saldo como saldo inicial: sin turno, sin categoría, origen saldo-inicial", async () => {
    const { db, creados } = baseFalsa([], []);
    const pasos: PasoApertura[] = [
      { tipo: "crear-cuenta", cuenta: "Mostrador", kind: "EFECTIVO", isVault: false },
      { tipo: "registrar-saldo", cuenta: "Mostrador", cuentaId: null, centavos: 12_345_00 },
    ];
    await aplicarApertura(db, { workspaceId: "w", pasos, ocurrido: OCURRIDO, userId: null });
    expect(creados).toEqual([
      expect.objectContaining({
        accountId: "nueva-1",
        shiftId: null,
        kind: "INGRESO",
        amountArs: "12345.00",
        occurredAt: OCURRIDO,
        categoryId: null,
        paymentMethod: "EFECTIVO",
        description: "Saldo inicial",
        sourceModule: "saldo-inicial",
        sourceRef: null,
      }),
    ]);
  });

  it("no carga un segundo saldo inicial si la cuenta ya tiene uno vigente", async () => {
    const { db, creados } = baseFalsa([SALDO_VIGENTE], [CAJA_FUERTE]);
    const pasos: PasoApertura[] = [{ tipo: "registrar-saldo", cuenta: "Caja fuerte", cuentaId: "a2", centavos: 1_00 }];
    await expect(aplicarApertura(db, { workspaceId: "w", pasos, ocurrido: OCURRIDO, userId: null })).rejects.toThrow(/ya tiene saldo inicial/);
    expect(creados).toEqual([]);
  });

  it("reemplazar = anular el vigente (conservando el origen) y cargar el nuevo; nunca edita", async () => {
    const { db, creados } = baseFalsa([SALDO_VIGENTE], [CAJA_FUERTE]);
    const pasos: PasoApertura[] = [
      { tipo: "reemplazar-saldo", cuenta: "Caja fuerte", cuentaId: "a2", movimientoId: "m1", deCentavos: 500_000_00, aCentavos: 600_000_00 },
    ];
    await aplicarApertura(db, { workspaceId: "w", pasos, ocurrido: OCURRIDO, userId: 7 });
    expect(creados).toHaveLength(2);
    expect(creados[0]).toMatchObject({
      kind: "EGRESO",
      amountArs: "500000.00",
      shiftId: null,
      reversesMovementId: "m1",
      reverseReason: MOTIVO_REEMPLAZO,
      sourceModule: "saldo-inicial",
      createdByUserId: 7,
    });
    expect(creados[1]).toMatchObject({ kind: "INGRESO", amountArs: "600000.00", sourceModule: "saldo-inicial", occurredAt: OCURRIDO });
  });

  it("reemplazar por $0 sólo anula", async () => {
    const { db, creados } = baseFalsa([SALDO_VIGENTE], [CAJA_FUERTE]);
    const pasos: PasoApertura[] = [
      { tipo: "reemplazar-saldo", cuenta: "Caja fuerte", cuentaId: "a2", movimientoId: "m1", deCentavos: 500_000_00, aCentavos: 0 },
    ];
    await aplicarApertura(db, { workspaceId: "w", pasos, ocurrido: OCURRIDO, userId: null });
    expect(creados).toHaveLength(1);
    expect(creados[0]).toMatchObject({ kind: "EGRESO", reversesMovementId: "m1" });
  });
});
