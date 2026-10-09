import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctxDePrueba } from "./ctx-prueba";

const M = vi.hoisted(() => {
  const d = (v: number) => ({ toString: () => v.toFixed(2) });
  const mov = (id: string, workspaceId: string, extra: Record<string, unknown> = {}) => ({
    id, workspaceId, occurredAt: new Date("2026-10-05T15:00:00Z"), kind: "INGRESO", amountArs: d(100), categoryId: "c-ing",
    transferId: null, reversesMovementId: null, sourceModule: "manual", ...extra,
  });
  const estado = {
    movimientos: [] as ReturnType<typeof mov>[],
    pedidos: [] as Record<string, unknown>[],
    cuentas: [] as Record<string, unknown>[],
  };
  type Donde = { workspaceId?: string; id?: { in: string[] } };
  const filtrar = <T extends { workspaceId: string; id?: string }>(filas: T[], w: Donde) =>
    filas.filter((f) => f.workspaceId === w.workspaceId && (!w.id || w.id.in.includes(f.id as string)));
  const wheres: { modelo: string; where: Donde }[] = [];
  const prisma = {
    cashMovement: {
      findMany: vi.fn(async (a: { where: Donde & { occurredAt?: unknown }; take?: number }) => {
        wheres.push({ modelo: "cashMovement", where: a.where });
        const filas = filtrar(estado.movimientos, a.where);
        // La lectura por rango trae sólo los del mes; la de originales trae por id.
        const r = a.where.id ? filas : filas.filter((f) => f.occurredAt >= new Date("2026-10-01T03:00:00Z"));
        return a.take ? r.slice(0, a.take) : r;
      }),
    },
    cashCategory: {
      findMany: vi.fn(async (a: { where: Donde }) => {
        wheres.push({ modelo: "cashCategory", where: a.where });
        return [
          { id: "c-ing", workspaceId: "w1", name: "Ventas", isActive: true, fotofficeRubro: { code: "3.1", parentCategoryId: null } },
        ].filter((c) => c.workspaceId === a.where.workspaceId);
      }),
    },
    fotofficePedido: {
      findMany: vi.fn(async (a: { where: Donde & { status?: unknown } }) => {
        wheres.push({ modelo: "fotofficePedido", where: a.where });
        return filtrar(estado.pedidos as never[], a.where);
      }),
    },
    fotofficeCuentaPagar: {
      findMany: vi.fn(async (a: { where: Donde }) => {
        wheres.push({ modelo: "fotofficeCuentaPagar", where: a.where });
        return filtrar(estado.cuentas as never[], a.where);
      }),
    },
  };
  return { prisma, estado, mov, d, wheres };
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: M.prisma, Prisma: {} }));

const { cargarResultados, baseElegida } = await import("./resultados-datos");
const AHORA = new Date("2026-10-09T15:00:00Z");

beforeEach(() => {
  M.estado.movimientos = [];
  M.estado.pedidos = [];
  M.estado.cuentas = [];
  M.wheres.length = 0;
  vi.clearAllMocks();
});

describe("cargarResultados", () => {
  it("sin permiso no lee nada", async () => {
    const r = await cargarResultados(ctxDePrueba("w1", "STAFF", {}), {}, AHORA);
    expect(r).toBeNull();
    expect(M.prisma.cashMovement.findMany).not.toHaveBeenCalled();
  });

  it("aísla por workspace en todas las consultas y suma centavos", async () => {
    M.estado.movimientos = [M.mov("m1", "w1"), M.mov("m2", "w2", { amountArs: M.d(9999) })];
    M.estado.pedidos = [{ workspaceId: "w1", status: "CONFIRMADO", eventDate: new Date("2026-10-20T00:00:00Z"), createdAt: AHORA, totalArs: M.d(500.55), incomeCategoryId: "c-ing" }];
    const caja = await cargarResultados(ctxDePrueba("w1"), { periodo: "este-mes" }, AHORA);
    expect(caja!.matriz!.resultado.total).toBe(10000);
    const dev = await cargarResultados(ctxDePrueba("w1"), { periodo: "este-mes", base: "devengado" }, AHORA);
    // movimiento manual (10000) + pedido 500,55 (50055)
    expect(dev!.matriz!.resultado.total).toBe(60055);
    expect(M.wheres.length).toBeGreaterThan(0);
    for (const w of M.wheres) expect(w.where.workspaceId).toBe("w1");
  });

  it("pide los pedidos sin cancelar y las cuentas con tope", async () => {
    await cargarResultados(ctxDePrueba("w1"), { base: "devengado" }, AHORA);
    const ped = M.wheres.find((w) => w.modelo === "fotofficePedido")!;
    expect(ped.where).toMatchObject({ status: { not: "CANCELADO" } });
    expect(M.prisma.fotofficePedido.findMany.mock.calls[0][0]).toMatchObject({ take: 20001 });
  });

  it("lee el original de una anulación aunque esté fuera del lote (otro mes) y del mismo workspace", async () => {
    M.estado.movimientos = [
      M.mov("anul", "w1", { kind: "EGRESO", reversesMovementId: "orig", categoryId: null }),
      M.mov("orig", "w1", { kind: "INGRESO", categoryId: "c-ing", occurredAt: new Date("2026-08-10T15:00:00Z") }),
      M.mov("orig", "w2", { kind: "INGRESO", categoryId: "otro", occurredAt: new Date("2026-08-10T15:00:00Z") }),
    ];
    const r = await cargarResultados(ctxDePrueba("w1"), { periodo: "este-mes" }, AHORA);
    const ingresos = r!.matriz!.bloques.find((b) => b.clave === "INGRESOS")!;
    // La anulación resta en el rubro del original: Ventas queda en -100,00.
    expect(ingresos.filas[0].total).toBe(-10000);
    const lecturaOriginal = M.wheres.filter((w) => w.modelo === "cashMovement" && w.where.id);
    expect(lecturaOriginal).toHaveLength(1);
    expect(lecturaOriginal[0].where).toMatchObject({ workspaceId: "w1", id: { in: ["orig"] } });
  });

  it("no pide originales que ya están en el lote", async () => {
    M.estado.movimientos = [M.mov("o", "w1"), M.mov("a", "w1", { kind: "EGRESO", reversesMovementId: "o" })];
    await cargarResultados(ctxDePrueba("w1"), {}, AHORA);
    expect(M.wheres.filter((w) => w.where.id)).toHaveLength(0);
  });

  it("pasado el tope de movimientos devuelve el aviso y ninguna matriz", async () => {
    M.estado.movimientos = Array.from({ length: 50_001 }, (_, i) => M.mov(`m${i}`, "w1"));
    const r = await cargarResultados(ctxDePrueba("w1"), {}, AHORA);
    expect(r!.matriz).toBeNull();
    expect(r!.avisos).toContain("Hay demasiados datos para este período, achicá el rango");
  });

  it("pasado el tope de pedidos devuelve el aviso (base devengada)", async () => {
    M.estado.pedidos = Array.from({ length: 20_001 }, () => ({ workspaceId: "w1", status: "CONFIRMADO", eventDate: null, createdAt: AHORA, totalArs: M.d(1), incomeCategoryId: null }));
    const r = await cargarResultados(ctxDePrueba("w1"), { base: "devengado" }, AHORA);
    expect(r!.matriz).toBeNull();
    expect(r!.avisos.at(-1)).toMatch(/demasiados datos/);
  });

  it("un período inválido usa el por omisión y lo avisa", async () => {
    const r = await cargarResultados(ctxDePrueba("w1"), { periodo: "cualquiera" }, AHORA);
    expect(r!.periodo.valor).toBe("este-mes");
    expect(r!.avisos[0]).toMatch(/período/);
  });

  it("baseElegida", () => {
    expect(baseElegida("devengado")).toBe("devengado");
    expect(baseElegida("x")).toBe("caja");
    expect(baseElegida(undefined)).toBe("caja");
  });
});
