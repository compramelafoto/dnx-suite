import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctxDePrueba } from "./ctx-prueba";

/** Flujo, monotributo y tablero: lectura con base falsa que respeta workspaceId, estados y fechas. */
const M = vi.hoisted(() => {
  const d = (v: number) => ({ toString: () => v.toFixed(2) });
  const dia = (s: string) => new Date(`${s}T00:00:00.000Z`);
  type Fila = Record<string, unknown> & { workspaceId: string };
  const e = {
    pedidos: [] as Fila[], cuotas: [] as Fila[], imputaciones: [] as Fila[], cobros: [] as Fila[],
    cuentas: [] as Fila[], cuentasCaja: [] as Fila[], movimientos: [] as Fila[], ajustes: [] as Fila[],
  };
  const wheres: { modelo: string; where: Record<string, unknown> }[] = [];
  const reg = (modelo: string, where: Record<string, unknown>) => wheres.push({ modelo, where });
  const prisma = {
    fotofficePedido: {
      findMany: vi.fn(async (a: { where: { workspaceId: string; status: { in: string[] } } }) => {
        reg("fotofficePedido", a.where);
        return e.pedidos.filter((p) => p.workspaceId === a.where.workspaceId && a.where.status.in.includes(p.status as string));
      }),
    },
    fotofficePedidoCuota: {
      findMany: vi.fn(async (a: { where: { workspaceId: string; pedidoId: { in: string[] } } }) => {
        reg("fotofficePedidoCuota", a.where);
        return e.cuotas.filter((c) => c.workspaceId === a.where.workspaceId && a.where.pedidoId.in.includes(c.pedidoId as string));
      }),
    },
    fotofficeCobroImputacion: {
      findMany: vi.fn(async (a: { where: { workspaceId: string; cuotaId: { in: string[] } } }) => {
        reg("fotofficeCobroImputacion", a.where);
        return e.imputaciones.filter((i) => i.workspaceId === a.where.workspaceId && a.where.cuotaId.in.includes(i.cuotaId as string));
      }),
    },
    fotofficeCobro: {
      findMany: vi.fn(async (a: { where: { workspaceId: string; id: { in: string[] } } }) => {
        reg("fotofficeCobro", a.where);
        return e.cobros.filter((c) => c.workspaceId === a.where.workspaceId && a.where.id.in.includes(c.id as string));
      }),
    },
    fotofficeCuentaPagar: {
      findMany: vi.fn(async (a: { where: { workspaceId: string; paidAt: null; OR: ({ dueDate: null } | { dueDate: { lte: Date } })[] } }) => {
        reg("fotofficeCuentaPagar", a.where);
        const lte = (a.where.OR.find((o) => o.dueDate && "lte" in o.dueDate)!.dueDate as { lte: Date }).lte;
        return e.cuentas.filter((c) => c.workspaceId === a.where.workspaceId && c.paidAt === a.where.paidAt && (c.dueDate === null || (c.dueDate as Date) <= lte));
      }),
    },
    cashAccount: {
      findMany: vi.fn(async (a: { where: { workspaceId: string; isActive: boolean } }) => {
        reg("cashAccount", a.where);
        return e.cuentasCaja.filter((c) => c.workspaceId === a.where.workspaceId && c.isActive === a.where.isActive);
      }),
    },
    cashMovement: {
      groupBy: vi.fn(async (a: { where: { workspaceId: string; accountId: { in: string[] } } }) => {
        reg("cashMovement.groupBy", a.where);
        const tot = new Map<string, number>();
        for (const m of e.movimientos) {
          if (m.workspaceId !== a.where.workspaceId || !a.where.accountId.in.includes(m.accountId as string)) continue;
          const k = `${m.accountId}|${m.kind}`;
          tot.set(k, (tot.get(k) ?? 0) + (m.pesos as number));
        }
        return [...tot].map(([k, v]) => { const [accountId, kind] = k.split("|"); return { accountId, kind, _sum: { amountArs: d(v) } }; });
      }),
      findMany: vi.fn(async (a: { where: { workspaceId: string; id?: { in: string[] } } }) => {
        reg("cashMovement", a.where);
        return e.movimientos.filter((m) => m.workspaceId === a.where.workspaceId && (!a.where.id || a.where.id.in.includes(m.id as string)))
          .map((m) => ({ ...m, amountArs: d(m.pesos as number) }));
      }),
    },
    cashCategory: {
      findMany: vi.fn(async (a: { where: { workspaceId: string } }) => {
        reg("cashCategory", a.where);
        return a.where.workspaceId === "w1" ? [{ id: "c-ing", name: "Ventas", isActive: true, fotofficeRubro: { code: "3.1", parentCategoryId: null } }] : [];
      }),
    },
    fotofficeInformesAjustes: {
      findUnique: vi.fn(async (a: { where: { workspaceId: string } }) => {
        reg("fotofficeInformesAjustes", a.where);
        return e.ajustes.find((x) => x.workspaceId === a.where.workspaceId) ?? null;
      }),
    },
  };
  return { prisma, e, d, dia, wheres };
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: M.prisma, Prisma: {} }));

const { cargarFlujo, hastaDeHorizonte, horizonteElegido, agrupacionElegida, leerSaldosDeCaja } = await import("./flujo-datos");
const { cargarMonotributo } = await import("./monotributo-datos");
const { cargarTablero } = await import("./tablero-datos");
const AHORA = new Date("2026-10-09T15:00:00Z");
const ctx = ctxDePrueba("w1");

function datos() {
  const { e, d, dia } = M;
  e.pedidos = [
    { workspaceId: "w1", id: "p1", status: "EN_CURSO", totalArs: d(1500) },
    { workspaceId: "w1", id: "p2", status: "CONFIRMADO", totalArs: d(300) },
    { workspaceId: "w1", id: "p4", status: "CANCELADO", totalArs: d(9000) },
    { workspaceId: "w2", id: "p9", status: "EN_CURSO", totalArs: d(777) },
  ];
  const cuota = (workspaceId: string, id: string, pedidoId: string, position: number, due: string, monto: number) =>
    ({ workspaceId, id, pedidoId, position, dueDate: dia(due), amountArs: d(monto), suggestedMethod: null });
  e.cuotas = [
    cuota("w1", "q1", "p1", 1, "2026-10-01", 600), // vencida, cobrada 100
    cuota("w1", "q2", "p1", 2, "2026-10-12", 400), // dentro de 7 días
    cuota("w1", "q3", "p1", 3, "2027-06-01", 500), // fuera del horizonte de 3 meses
    cuota("w1", "q4", "p2", 1, "2026-10-30", 300), // pagada entera: fuera
    cuota("w1", "q5", "p4", 1, "2026-10-15", 9000), // pedido cancelado
    cuota("w2", "q9", "p9", 1, "2026-10-10", 777), // otro workspace
  ];
  e.imputaciones = [
    { workspaceId: "w1", cobroId: "k1", cuotaId: "q1", amountArs: d(100) },
    { workspaceId: "w1", cobroId: "k2", cuotaId: "q1", amountArs: d(300) }, // cobro anulado: no cuenta
    { workspaceId: "w1", cobroId: "k3", cuotaId: "q4", amountArs: d(300) },
  ];
  e.cobros = [
    { workspaceId: "w1", id: "k1", voidedAt: null },
    { workspaceId: "w1", id: "k2", voidedAt: new Date() },
    { workspaceId: "w1", id: "k3", voidedAt: null },
  ];
  e.cuentas = [
    { workspaceId: "w1", paidAt: null, dueDate: dia("2026-10-10"), amountArs: d(70) },
    { workspaceId: "w1", paidAt: null, dueDate: null, amountArs: d(30) },
    { workspaceId: "w1", paidAt: new Date(), dueDate: dia("2026-10-11"), amountArs: d(5000) }, // pagada
    { workspaceId: "w1", paidAt: null, dueDate: dia("2027-06-01"), amountArs: d(4000) }, // fuera del horizonte
    { workspaceId: "w2", paidAt: null, dueDate: dia("2026-10-10"), amountArs: d(888) },
  ];
  e.cuentasCaja = [
    { workspaceId: "w1", id: "a1", name: "Caja", isVault: false, isActive: true },
    { workspaceId: "w1", id: "a2", name: "Vieja", isVault: false, isActive: false },
    { workspaceId: "w2", id: "a9", name: "Ajena", isVault: false, isActive: true },
  ];
  const mov = (workspaceId: string, id: string, accountId: string, kind: string, pesos: number, extra: Record<string, unknown> = {}) =>
    ({ workspaceId, id, accountId, kind, pesos, occurredAt: new Date("2026-10-05T15:00:00Z"), categoryId: "c-ing", transferId: null, reversesMovementId: null, sourceModule: "manual", ...extra });
  e.movimientos = [
    mov("w1", "m1", "a1", "INGRESO", 1000),
    mov("w1", "m2", "a1", "EGRESO", 200, { categoryId: null }),
    mov("w1", "m3", "a2", "INGRESO", 5000), // cuenta inactiva: fuera del saldo
    mov("w2", "m9", "a9", "INGRESO", 123456),
  ];
  e.ajustes = [{ workspaceId: "w1", minBalanceArs: d(1250), monotributoCategory: "C", monotributoCapArs: d(1000), monotributoWarnPct: 80 }];
}

beforeEach(() => {
  vi.clearAllMocks();
  M.wheres.length = 0;
  datos();
});

const soloW1 = () => {
  expect(M.wheres.length).toBeGreaterThan(0);
  for (const w of M.wheres) expect(w.where.workspaceId).toBe("w1");
};

describe("horizonte", () => {
  it("calcula el último día y recorta al último del mes", () => {
    expect(hastaDeHorizonte("2026-10-09", "7d")).toBe("2026-10-16");
    expect(hastaDeHorizonte("2026-01-31", "1m")).toBe("2026-02-28");
    expect(hastaDeHorizonte("2026-10-09", "12m")).toBe("2027-10-09");
  });
  it("lo inválido vuelve a los valores por omisión (nunca más de 12 meses)", () => {
    expect(horizonteElegido("36m")).toBe("3m");
    expect(horizonteElegido("12m")).toBe("12m");
    expect(agrupacionElegida("hora")).toBe("semana");
  });
});

describe("saldo de Caja", () => {
  it("sólo cuentas activas del workspace", async () => {
    const s = await leerSaldosDeCaja("w1");
    expect(s.cuentas.map((c) => c.id)).toEqual(["a1"]);
    expect(s.total).toBe(80000);
    soloW1();
  });
});

describe("cargarFlujo", () => {
  it("sin permiso no lee nada", async () => {
    expect(await cargarFlujo(ctxDePrueba("w1", "STAFF", {}), {}, AHORA)).toBeNull();
    expect(M.prisma.fotofficePedido.findMany).not.toHaveBeenCalled();
    expect(M.prisma.cashAccount.findMany).not.toHaveBeenCalled();
  });

  it("arma el flujo: sin cancelados, sin cuotas pagadas ni cobros anulados, sin otro workspace ni lo posterior al horizonte", async () => {
    const r = await cargarFlujo(ctx, { agrupar: "mes", horizonte: "3m" }, AHORA);
    const f = r!.flujo!;
    expect(f.hoy.saldoCaja).toBe(80000);
    expect(f.hoy.vencidoCobrar).toBe(50000); // 600 - 100 (el cobro anulado no cuenta)
    expect(f.hoy.vencidoPagar).toBe(0);
    expect(f.sinFecha).toMatchObject({ porPagar: 3000, cantidad: 1 });
    const porCobrar = f.filas.reduce((s, x) => s + x.porCobrar, 0);
    const porPagar = f.filas.reduce((s, x) => s + x.porPagar, 0);
    expect(porCobrar).toBe(40000); // sólo q2; q3 (2027) queda afuera; q4 pagada; p4 cancelado
    expect(porPagar).toBe(7000); // sólo a1; la pagada y la de 2027 no
    expect(r!.hasta).toBe("2027-01-09");
    soloW1();
  });

  it("pide al servidor sólo hasta el horizonte", async () => {
    await cargarFlujo(ctx, { horizonte: "1m" }, AHORA);
    const ped = M.wheres.find((w) => w.modelo === "fotofficePedido")!;
    expect(JSON.stringify(ped.where)).toContain("2026-11-09T00:00:00.000Z");
    const cta = M.wheres.find((w) => w.modelo === "fotofficeCuentaPagar")!;
    expect(cta.where).toMatchObject({ paidAt: null });
    expect(JSON.stringify(cta.where)).toContain("2026-11-09T00:00:00.000Z");
  });

  it("a 12 meses por día no pasa de 366 filas", async () => {
    const r = await cargarFlujo(ctx, { agrupar: "dia", horizonte: "12m" }, AHORA);
    expect(r!.flujo!.filas).toHaveLength(366);
  });

  it("marca la primera fecha bajo el saldo mínimo", async () => {
    const r = await cargarFlujo(ctx, { agrupar: "dia", horizonte: "1m" }, AHORA);
    // hoy: 800 + 500 = 1300 (>= 1250); el 10/10 paga 70 -> 1230 < 1250
    expect(r!.saldoMinimo).toBe(125000);
    expect(r!.flujo!.primeraFechaBajoMinimo).toBe("2026-10-10");
  });

  it("pasado el tope de cuentas avisa y no devuelve flujo parcial", async () => {
    M.e.cuentas = Array.from({ length: 20_001 }, () => ({ workspaceId: "w1", paidAt: null, dueDate: null, amountArs: M.d(1) }));
    const r = await cargarFlujo(ctx, {}, AHORA);
    expect(r!.flujo).toBeNull();
    expect(r!.avisos).toEqual(["Hay demasiados datos para este período, achicá el rango"]);
  });
});

describe("cargarMonotributo", () => {
  it("sin permiso no lee nada", async () => {
    expect(await cargarMonotributo(ctxDePrueba("w1", "STAFF", {}), AHORA)).toBeNull();
    expect(M.prisma.cashMovement.findMany).not.toHaveBeenCalled();
  });

  it("suma los ingresos de Caja del workspace (sin transferencias, netos de anulaciones) y da el semáforo", async () => {
    M.e.movimientos.push(
      { workspaceId: "w1", id: "t1", accountId: "a1", kind: "INGRESO", pesos: 9999, occurredAt: new Date("2026-10-06T15:00:00Z"), categoryId: null, transferId: "tr", reversesMovementId: null, sourceModule: "manual" },
      // anulación de un ingreso de otro mes: resta 50 en el mes de la anulación
      { workspaceId: "w1", id: "an", accountId: "a1", kind: "EGRESO", pesos: 50, occurredAt: new Date("2026-10-07T15:00:00Z"), categoryId: null, transferId: null, reversesMovementId: "viejo", sourceModule: "manual" },
      { workspaceId: "w1", id: "viejo", accountId: "a1", kind: "INGRESO", pesos: 50, occurredAt: new Date("2026-03-01T15:00:00Z"), categoryId: "c-ing", transferId: null, reversesMovementId: null, sourceModule: "manual" },
    );
    const r = await cargarMonotributo(ctx, AHORA);
    // m1 (1000) + m3 (5000, otra cuenta pero ingreso de Caja) + viejo (50) - anulación (50) = 6000: ROJO (tope 1000)
    expect(r!.resultado!.total).toBe(600000);
    expect(r!.resultado!.estado).toBe("ROJO");
    expect(r!.categoria).toBe("C");
    expect(r!.leyenda).toMatch(/ARCA/);
    soloW1();
  });
});

describe("cargarTablero", () => {
  it("sin permiso no lee nada", async () => {
    expect(await cargarTablero(ctxDePrueba("w1", "STAFF", {}), AHORA)).toBeNull();
    expect(M.prisma.fotofficeInformesAjustes.findUnique).not.toHaveBeenCalled();
  });

  it("junta todo con las mismas reglas", async () => {
    const t = (await cargarTablero(ctx, AHORA))!;
    expect(t.porCobrar).toEqual({ vencido: 50000, en7: 40000, en30: 40000 });
    expect(t.porPagar).toEqual({ vencido: 0, en7: 7000, en30: 7000, sinFecha: 3000 });
    expect(t.saldos.total).toBe(80000);
    expect(t.primeraFechaBajoMinimo).toBe("2026-10-10");
    expect(t.resultadoMes).toMatchObject({ mes: "2026-10", ingresos: 600000, egresos: 20000 });
    expect(t.resultadoMesAnterior).toMatchObject({ mes: "2026-09", resultado: 0 });
    expect(t.monotributo!.estado).toBe("ROJO");
    expect(t.avisos).toEqual([]);
    soloW1();
  });

  it("con otro workspace sin datos no ve nada ajeno", async () => {
    const t = (await cargarTablero(ctxDePrueba("w3"), AHORA))!;
    expect(t.porCobrar).toEqual({ vencido: 0, en7: 0, en30: 0 });
    expect(t.saldos.total).toBe(0);
    expect(t.monotributo!.estado).toBe("SIN_CONFIGURAR");
    expect(t.primeraFechaBajoMinimo).toBeNull();
  });
});
