import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctxDePrueba } from "./ctx-prueba";

/** Desglose: cada celda del detalle suma lo mismo que la celda de la matriz, con las mismas reglas. */
const M = vi.hoisted(() => {
  const d = (v: number) => ({ toString: () => v.toFixed(2) });
  const dia = (s: string) => new Date(`${s}T00:00:00.000Z`);
  type Fila = Record<string, unknown> & { workspaceId: string };
  const e = {
    movimientos: [] as Fila[], pedidos: [] as Fila[], cuentas: [] as Fila[], cuotas: [] as Fila[],
    imputaciones: [] as Fila[], cobros: [] as Fila[],
  };
  type W = { workspaceId: string; id?: { in: string[] }; occurredAt?: { gte: Date; lt: Date } };
  const wheres: { modelo: string; where: Record<string, unknown> }[] = [];
  const reg = (modelo: string, where: Record<string, unknown>) => wheres.push({ modelo, where });
  const prisma = {
    cashMovement: {
      findMany: vi.fn(async (a: { where: W }) => {
        reg("cashMovement", a.where as never);
        return e.movimientos.filter(
          (m) =>
            m.workspaceId === a.where.workspaceId &&
            (!a.where.id || a.where.id.in.includes(m.id as string)) &&
            (!a.where.occurredAt || ((m.occurredAt as Date) >= a.where.occurredAt.gte && (m.occurredAt as Date) < a.where.occurredAt.lt)),
        );
      }),
    },
    cashCategory: {
      findMany: vi.fn(async (a: { where: { workspaceId: string } }) => {
        reg("cashCategory", a.where);
        return [
          { id: "c-ing", workspaceId: "w1", name: "Ventas", isActive: true, fotofficeRubro: { code: "3.1", parentCategoryId: null } },
          { id: "c-cos", workspaceId: "w1", name: "Insumos", isActive: true, fotofficeRubro: { code: "4.1", parentCategoryId: null } },
        ].filter((c) => c.workspaceId === a.where.workspaceId);
      }),
    },
    fotofficePedido: {
      findMany: vi.fn(async (a: { where: { workspaceId: string; status: { not: string } | { in: string[] } } }) => {
        reg("fotofficePedido", a.where);
        return e.pedidos.filter((p) => {
          if (p.workspaceId !== a.where.workspaceId) return false;
          const s = a.where.status;
          return "in" in s ? s.in.includes(p.status as string) : p.status !== s.not;
        });
      }),
    },
    fotofficeCuentaPagar: {
      findMany: vi.fn(async (a: { where: { workspaceId: string; paidAt?: null; dueDate?: null | { lte: Date; gte?: Date } } }) => {
        reg("fotofficeCuentaPagar", a.where);
        return e.cuentas.filter((c) => {
          if (c.workspaceId !== a.where.workspaceId) return false;
          if (a.where.paidAt === null && c.paidAt !== null) return false;
          const dd = a.where.dueDate;
          if (dd === null) return c.dueDate === null;
          if (dd) return c.dueDate !== null && (c.dueDate as Date) <= dd.lte && (!dd.gte || (c.dueDate as Date) >= dd.gte);
          return true;
        });
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
  };
  return { prisma, e, d, dia, wheres };
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: M.prisma, Prisma: {} }));

const { cargarDetalleResultados, cargarDetalleFlujo } = await import("./detalle-datos");
const { cargarResultados } = await import("./resultados-datos");
const AHORA = new Date("2026-10-09T15:00:00Z");

function mov(id: string, workspaceId: string, extra: Record<string, unknown> = {}) {
  return {
    id, workspaceId, occurredAt: new Date("2026-10-05T15:00:00Z"), kind: "INGRESO", amountArs: M.d(100), categoryId: "c-ing",
    transferId: null, reversesMovementId: null, sourceModule: "manual", sourceRef: null, description: `Mov ${id}`,
    account: { name: "Mostrador" }, client: null, ...extra,
  };
}

beforeEach(() => {
  M.e.movimientos = []; M.e.pedidos = []; M.e.cuentas = []; M.e.cuotas = []; M.e.imputaciones = []; M.e.cobros = [];
  M.wheres.length = 0;
  vi.clearAllMocks();
});

const celda = { base: "caja", periodo: "este-mes", bloque: "INGRESOS", rubro: "c-ing", mes: "2026-10" };

describe("cargarDetalleResultados · cobrado y pagado", () => {
  it("sin permiso no lee nada", async () => {
    expect(await cargarDetalleResultados(ctxDePrueba("w1", "STAFF", {}), celda, AHORA)).toBeNull();
    expect(M.prisma.cashMovement.findMany).not.toHaveBeenCalled();
  });

  it("una celda inválida no devuelve nada", async () => {
    expect(await cargarDetalleResultados(ctxDePrueba(), { ...celda, bloque: "OTRO" }, AHORA)).toBeNull();
  });

  it("lista los movimientos de la celda y suma lo mismo que la matriz (transferencias fuera, otro workspace fuera)", async () => {
    M.e.movimientos = [
      mov("m1", "w1", { amountArs: M.d(100.5), client: { firstName: "Ana", lastName: "Paz", businessName: null } }),
      mov("m2", "w1", { amountArs: M.d(50), occurredAt: new Date("2026-10-07T15:00:00Z") }),
      mov("m3", "w1", { transferId: "t1", amountArs: M.d(999) }),
      mov("m4", "w2", { amountArs: M.d(7777) }),
      mov("m5", "w1", { kind: "EGRESO", categoryId: "c-cos", amountArs: M.d(30) }),
    ];
    const d = await cargarDetalleResultados(ctxDePrueba(), celda, AHORA);
    expect(d!.filas.map((f) => f.clave)).toEqual(["m:m1", "m:m2"]);
    expect(d!.filas[0]).toMatchObject({ fecha: "2026-10-05", origen: "Movimiento manual (Mostrador)", contacto: "Ana Paz", descripcion: "Mov m1", centavos: 10050 });
    expect(d!.total).toBe(15050);
    const r = await cargarResultados(ctxDePrueba(), { periodo: "este-mes" }, AHORA);
    const fila = r!.matriz!.bloques.find((b) => b.clave === "INGRESOS")!.filas[0];
    expect(fila.porMes[0]).toBe(d!.total);
    expect(M.wheres.every((w) => w.where.workspaceId === "w1")).toBe(true);
  });

  it("una anulación del mes siguiente resta en el rubro y el bloque del original (original leído por id)", async () => {
    M.e.movimientos = [
      mov("orig", "w1", { occurredAt: new Date("2026-09-20T15:00:00Z"), amountArs: M.d(200) }),
      mov("anul", "w1", { kind: "EGRESO", categoryId: null, reversesMovementId: "orig", amountArs: M.d(200), occurredAt: new Date("2026-10-06T15:00:00Z") }),
    ];
    const d = await cargarDetalleResultados(ctxDePrueba(), celda, AHORA);
    expect(d!.filas).toHaveLength(1);
    expect(d!.filas[0]).toMatchObject({ centavos: -20000 });
    expect(d!.filas[0].origen).toMatch(/^Anulación/);
    expect(d!.total).toBe(-20000);
    const r = await cargarResultados(ctxDePrueba(), { periodo: "este-mes" }, AHORA);
    expect(r!.matriz!.bloques.find((b) => b.clave === "INGRESOS")!.filas[0].porMes[0]).toBe(-20000);
  });

  it("'Sin rubro' y el bloque Sin clasificar tienen su desglose", async () => {
    M.e.movimientos = [mov("s1", "w1", { categoryId: null, amountArs: M.d(12.34) })];
    const d = await cargarDetalleResultados(ctxDePrueba(), { ...celda, bloque: "SIN_CLASIFICAR_INGRESO", rubro: "sin" }, AHORA);
    expect(d!.total).toBe(1234);
    expect(d!.titulo).toContain("Sin rubro");
  });

  it("un mes fuera del período se ignora (se muestra todo el período)", async () => {
    M.e.movimientos = [mov("m1", "w1")];
    const d = await cargarDetalleResultados(ctxDePrueba(), { ...celda, mes: "2025-01" }, AHORA);
    expect(d!.filtro.mes).toBeNull();
    expect(d!.total).toBe(10000);
  });
});

describe("cargarDetalleResultados · vendido y comprometido", () => {
  it("pedidos, cuentas y movimientos que no vienen de pedidos; los cobros de pedidos no se cuentan dos veces", async () => {
    M.e.pedidos = [
      { id: "p1", workspaceId: "w1", number: "P-1", status: "CONFIRMADO", eventDate: M.dia("2026-10-20"), eventLabel: "Casamiento", createdAt: AHORA, totalArs: M.d(1000.55), incomeCategoryId: "c-ing", client: { firstName: null, lastName: null, businessName: "Cliente SA" } },
      { id: "p2", workspaceId: "w1", number: "P-2", status: "CANCELADO", eventDate: M.dia("2026-10-21"), eventLabel: null, createdAt: AHORA, totalArs: M.d(5000), incomeCategoryId: "c-ing", client: null },
      { id: "p3", workspaceId: "w2", number: "P-3", status: "CONFIRMADO", eventDate: M.dia("2026-10-22"), eventLabel: null, createdAt: AHORA, totalArs: M.d(8000), incomeCategoryId: "c-ing", client: null },
    ];
    M.e.cuentas = [
      { id: "q1", workspaceId: "w1", pedidoId: "p1", concept: "Álbum", dueDate: M.dia("2026-10-25"), createdAt: AHORA, amountArs: M.d(300), costCategoryId: "c-cos", supplier: null, pedido: { number: "P-1" } },
    ];
    M.e.movimientos = [
      mov("manual", "w1", { amountArs: M.d(10) }),
      mov("cobro", "w1", { sourceModule: "pedidos", sourceRef: "cb1", amountArs: M.d(500) }),
    ];
    const ing = await cargarDetalleResultados(ctxDePrueba(), { ...celda, base: "devengado" }, AHORA);
    expect(ing!.filas.map((f) => f.clave).sort()).toEqual(["m:manual", "p:p1"]);
    expect(ing!.total).toBe(100055 + 1000);
    expect(ing!.filas.find((f) => f.clave === "p:p1")).toMatchObject({ origen: "Pedido P-1", contacto: "Cliente SA", descripcion: "Casamiento", href: "/pedidos/p1" });
    const cos = await cargarDetalleResultados(ctxDePrueba(), { ...celda, base: "devengado", bloque: "COSTOS", rubro: "c-cos" }, AHORA);
    expect(cos!.filas).toHaveLength(1);
    expect(cos!.filas[0]).toMatchObject({ descripcion: "Álbum", href: "/pedidos/p1", centavos: 30000 });
    const r = await cargarResultados(ctxDePrueba(), { periodo: "este-mes", base: "devengado" }, AHORA);
    expect(r!.matriz!.bloques.find((b) => b.clave === "INGRESOS")!.filas[0].porMes[0]).toBe(ing!.total);
    expect(r!.matriz!.bloques.find((b) => b.clave === "COSTOS")!.filas[0].porMes[0]).toBe(cos!.total);
  });
});

describe("cargarDetalleFlujo", () => {
  it("sin permiso o con parámetros inválidos no devuelve nada", async () => {
    expect(await cargarDetalleFlujo(ctxDePrueba("w1", "STAFF", {}), { tipo: "pagar", hasta: "2026-10-31" }, AHORA)).toBeNull();
    expect(await cargarDetalleFlujo(ctxDePrueba(), { tipo: "pagar", hasta: "2026-13-40" }, AHORA)).toBeNull();
    expect(await cargarDetalleFlujo(ctxDePrueba(), { tipo: "pagar", hasta: "2030-01-01" }, AHORA)).toBeNull();
    expect(await cargarDetalleFlujo(ctxDePrueba(), { tipo: "otro", hasta: "2026-10-31" }, AHORA)).toBeNull();
  });

  it("cuentas por pagar sin pago vigente, por rango y sin fecha; sólo del workspace", async () => {
    M.e.cuentas = [
      { id: "a", workspaceId: "w1", pedidoId: null, concept: "Alquiler", dueDate: M.dia("2026-10-15"), createdAt: AHORA, amountArs: M.d(100), paidAt: null, supplier: null, pedido: null },
      { id: "b", workspaceId: "w1", pedidoId: null, concept: "Pagada", dueDate: M.dia("2026-10-15"), createdAt: AHORA, amountArs: M.d(100), paidAt: AHORA, supplier: null, pedido: null },
      { id: "c", workspaceId: "w2", pedidoId: null, concept: "Ajena", dueDate: M.dia("2026-10-15"), createdAt: AHORA, amountArs: M.d(100), paidAt: null, supplier: null, pedido: null },
      { id: "d", workspaceId: "w1", pedidoId: null, concept: "Luz", dueDate: null, createdAt: AHORA, amountArs: M.d(40.25), paidAt: null, supplier: null, pedido: null },
      { id: "e", workspaceId: "w1", pedidoId: null, concept: "Vieja", dueDate: M.dia("2026-10-01"), createdAt: AHORA, amountArs: M.d(10), paidAt: null, supplier: null, pedido: null },
    ];
    const rango = await cargarDetalleFlujo(ctxDePrueba(), { tipo: "pagar", desde: "2026-10-09", hasta: "2026-10-31" }, AHORA);
    expect(rango!.filas.map((f) => f.clave)).toEqual(["c:a"]);
    const vencido = await cargarDetalleFlujo(ctxDePrueba(), { tipo: "pagar", hasta: "2026-10-08" }, AHORA);
    expect(vencido!.filas.map((f) => f.clave)).toEqual(["c:e"]);
    const sin = await cargarDetalleFlujo(ctxDePrueba(), { tipo: "sinfecha" }, AHORA);
    expect(sin!.filas.map((f) => f.clave)).toEqual(["c:d"]);
    expect(sin!.total).toBe(4025);
  });

  it("cuotas por cobrar: el saldo de cada cuota con saldo, en el rango", async () => {
    M.e.pedidos = [{ id: "p1", workspaceId: "w1", number: "P-1", status: "CONFIRMADO", totalArs: M.d(1000), client: { firstName: "Ana", lastName: null, businessName: null } }];
    M.e.cuotas = [
      { id: "q1", workspaceId: "w1", pedidoId: "p1", position: 1, dueDate: M.dia("2026-10-10"), amountArs: M.d(600), suggestedMethod: null },
      { id: "q2", workspaceId: "w1", pedidoId: "p1", position: 2, dueDate: M.dia("2026-11-10"), amountArs: M.d(400), suggestedMethod: null },
    ];
    M.e.imputaciones = [{ workspaceId: "w1", cobroId: "cb", cuotaId: "q1", amountArs: M.d(250) }];
    M.e.cobros = [{ id: "cb", workspaceId: "w1", voidedAt: null }];
    const d = await cargarDetalleFlujo(ctxDePrueba(), { tipo: "cobrar", desde: "2026-10-09", hasta: "2026-10-31" }, AHORA);
    expect(d!.filas).toHaveLength(1);
    expect(d!.filas[0]).toMatchObject({ origen: "Pedido P-1", contacto: "Ana", centavos: 35000, href: "/pedidos/p1", fecha: "2026-10-10" });
    expect(d!.total).toBe(35000);
  });
});
