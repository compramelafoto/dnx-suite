import { describe, expect, it } from "vitest";
import type { Prisma } from "@repo/db";
import { createCashTransfer, suggestedDropMinor, validateTransfer } from "./transfer";

describe("suggestedDropMinor", () => {
  it("propone pasar todo lo que sobra del fondo fijo", () => {
    expect(suggestedDropMinor({ countedMinor: 47_300_00, fixedFloatMinor: 20_000_00 })).toBe(27_300_00);
  });

  it("si contaste justo el fondo fijo, no hay nada que pasar", () => {
    expect(suggestedDropMinor({ countedMinor: 20_000_00, fixedFloatMinor: 20_000_00 })).toBe(0);
  });

  it("si contaste menos que el fondo fijo, no propone un pase negativo", () => {
    expect(suggestedDropMinor({ countedMinor: 15_000_00, fixedFloatMinor: 20_000_00 })).toBe(0);
  });

  it("sin fondo fijo configurado propone pasar todo", () => {
    expect(suggestedDropMinor({ countedMinor: 47_300_00, fixedFloatMinor: 0 })).toBe(47_300_00);
  });
});

describe("validateTransfer", () => {
  const base = { fromAccountId: "diaria", toAccountId: "fuerte", fromBalanceMinor: 50_000_00 };

  it("un pase normal se acepta", () => {
    expect(validateTransfer({ ...base, amountMinor: 30_000_00 })).toEqual({ ok: true });
  });

  it("pasar todo el saldo se acepta", () => {
    expect(validateTransfer({ ...base, amountMinor: 50_000_00 })).toEqual({ ok: true });
  });

  it("no se pasa más de lo que hay en la cuenta de origen", () => {
    expect(validateTransfer({ ...base, amountMinor: 60_000_00 })).toEqual({
      ok: false,
      error: "No podés pasar más plata de la que hay en esa cuenta.",
    });
  });

  it("un importe de cero se rechaza", () => {
    expect(validateTransfer({ ...base, amountMinor: 0 })).toEqual({
      ok: false,
      error: "El importe tiene que ser mayor que cero.",
    });
  });

  it("un importe negativo se rechaza: el sentido lo dan las cuentas, no el signo", () => {
    expect(validateTransfer({ ...base, amountMinor: -100_00 })).toEqual({
      ok: false,
      error: "El importe tiene que ser mayor que cero.",
    });
  });

  it("no se pasa plata de una cuenta a sí misma", () => {
    expect(
      validateTransfer({ ...base, toAccountId: "diaria", amountMinor: 10_000_00 }),
    ).toEqual({ ok: false, error: "Elegí dos cuentas distintas." });
  });
});

describe("createCashTransfer", () => {
  /**
   * `tx` de prueba: no toca una base de verdad, sólo registra qué se le pidió y devuelve lo
   * que cada test necesita. Alcanza porque lo que hay que probar acá es a qué `shiftId` queda
   * atada cada pata, no el comportamiento real de Prisma.
   */
  function fakeTx(turnoAbiertoDestino: { id: string } | null) {
    const llamadas: { modelo: string; metodo: string; args: unknown }[] = [];
    let movimientosCreados: Array<Record<string, unknown>> = [];
    const tx = {
      cashTransfer: {
        create: async (args: { data: Record<string, unknown> }) => {
          llamadas.push({ modelo: "cashTransfer", metodo: "create", args });
          return { id: "transfer-1" };
        },
      },
      cashShift: {
        findFirst: async (args: { where: Record<string, unknown> }) => {
          llamadas.push({ modelo: "cashShift", metodo: "findFirst", args });
          return turnoAbiertoDestino;
        },
      },
      cashMovement: {
        createMany: async (args: { data: Array<Record<string, unknown>> }) => {
          llamadas.push({ modelo: "cashMovement", metodo: "createMany", args });
          movimientosCreados = args.data;
          return { count: args.data.length };
        },
      },
    } as unknown as Prisma.TransactionClient;
    return { tx, llamadas, movimientos: () => movimientosCreados };
  }

  const inputBase = {
    workspaceId: "ws-1",
    fromAccountId: "diaria",
    toAccountId: "fuerte",
    amountMinor: 27_300_00,
    occurredAt: new Date("2026-09-13T12:00:00Z"),
    note: "Pase de cierre",
  };

  it("la pata de ENTRADA se ata al turno abierto de la cuenta destino", async () => {
    // Es el caso que C2 dejaba roto: reponer el fondo de vuelto del mostrador sacando plata
    // de la caja fuerte hacía que ese ingreso quedara fuera del arqueo del turno destino.
    const { tx, movimientos } = fakeTx({ id: "turno-destino" });
    await createCashTransfer(tx, inputBase);

    const ingreso = movimientos().find((m) => m.kind === "INGRESO");
    expect(ingreso?.shiftId).toBe("turno-destino");
  });

  it("sin turno abierto en la cuenta destino, la pata de ENTRADA queda sin turno como antes", async () => {
    // El caso de todos los días: mostrador a caja fuerte. La caja fuerte no lleva turno, así
    // que esto no cambia nada respecto de lo que ya funcionaba.
    const { tx, movimientos } = fakeTx(null);
    await createCashTransfer(tx, inputBase);

    const ingreso = movimientos().find((m) => m.kind === "INGRESO");
    expect(ingreso?.shiftId).toBeNull();
  });

  it("la pata de SALIDA sigue atada al turno que le pasó quien llama, no al de la cuenta destino", async () => {
    const { tx, movimientos } = fakeTx({ id: "turno-destino" });
    await createCashTransfer(tx, { ...inputBase, fromShiftId: "turno-origen" });

    const egreso = movimientos().find((m) => m.kind === "EGRESO");
    expect(egreso?.shiftId).toBe("turno-origen");
  });

  it("busca el turno abierto de la cuenta DESTINO, no la de origen", async () => {
    const { tx, llamadas } = fakeTx({ id: "turno-destino" });
    await createCashTransfer(tx, inputBase);

    const busqueda = llamadas.find((l) => l.modelo === "cashShift" && l.metodo === "findFirst");
    expect(busqueda).toBeDefined();
    const where = (busqueda!.args as { where: Record<string, unknown> }).where;
    expect(where.accountId).toBe(inputBase.toAccountId);
    expect(where.workspaceId).toBe(inputBase.workspaceId);
    expect(where.status).toBe("ABIERTO");
  });
});
