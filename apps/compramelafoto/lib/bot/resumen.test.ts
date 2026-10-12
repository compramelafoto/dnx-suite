import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ convCount: vi.fn(), convGroup: vi.fn(), actGroup: vi.fn(), incidents: vi.fn(), usage: vi.fn(), outGroup: vi.fn(), outFind: vi.fn(), users: vi.fn(), orders: vi.fn(), albums: vi.fn(), progreso: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    botConversation: { count: (...a: unknown[]) => m.convCount(...a), groupBy: (...a: unknown[]) => m.convGroup(...a) },
    botAction: { groupBy: (...a: unknown[]) => m.actGroup(...a) },
    botIncident: { findMany: (...a: unknown[]) => m.incidents(...a) },
    botUsageDaily: { aggregate: (...a: unknown[]) => m.usage(...a) },
    botOutreach: { groupBy: (...a: unknown[]) => m.outGroup(...a), findMany: (...a: unknown[]) => m.outFind(...a) },
    user: { findMany: (...a: unknown[]) => m.users(...a) },
    order: { findMany: (...a: unknown[]) => m.orders(...a) },
    album: { findMany: (...a: unknown[]) => m.albums(...a) },
  },
}));
vi.mock("@/lib/bot/escolar/progreso", () => ({ computeSchoolSetupProgress: (...a: unknown[]) => m.progreso(...a) }));
import { buildDailySummary } from "./resumen";

beforeEach(() => {
  vi.clearAllMocks();
  m.convCount.mockResolvedValue(10);
  m.convGroup.mockResolvedValue([{ status: "ESCALATED", _count: { _all: 2 } }]);
  m.actGroup.mockResolvedValue([{ status: "EXECUTED", _count: { _all: 5 } }]);
  m.incidents.mockResolvedValue([{ title: "album: P2002", occurrences: 3, urgent: true }]);
  m.usage.mockResolvedValue({ _sum: { costMicroUsd: 1_500_000 } });
  m.outGroup.mockResolvedValue([]);
  m.outFind.mockResolvedValue([]);
  m.users.mockResolvedValue([]);
  m.orders.mockResolvedValue([]);
  m.albums.mockResolvedValue([]);
  m.progreso.mockReset();
});

describe("buildDailySummary", () => {
  it("incluye conversaciones, derivadas, acciones, errores y gasto en dólares aclarado", async () => {
    const t = await buildDailySummary(new Date("2026-10-12T12:00:00Z"));
    expect(t).toContain("10 conversaciones");
    expect(t).toContain("2 derivadas");
    expect(t).toContain("5 acciones");
    expect(t).toContain("album: P2002 (×3)");
    expect(t).toContain("USD 1,50");
    expect(t).toContain("se factura en dólares");
    expect(t).toContain("2026-10-12");
  });

  it("sin errores ni gasto lo dice", async () => {
    m.incidents.mockResolvedValue([]);
    m.usage.mockResolvedValue({ _sum: { costMicroUsd: null } });
    const t = await buildDailySummary(new Date("2026-10-12T12:00:00Z"));
    expect(t).toContain("Sin errores del sistema");
    expect(t).toContain("USD 0,00");
  });

  it("sin actividad escolar ni de saludos informa ceros", async () => {
    const t = await buildDailySummary(new Date("2026-10-12T12:00:00Z"));
    expect(t).toContain("Saludos: ninguno");
    expect(t).toContain("Mails: 0 enviados.");
    expect(t).toContain("Primeras ventas este mes: 0 fotógrafos.");
    expect(t).toContain("Álbumes escolares con preventa publicada: 0.");
  });

  it("cuenta saludos mostrados, tocados y rechazados por campaña", async () => {
    m.outGroup.mockResolvedValue([
      { campaign: "nuevo", status: "SHOWN", _count: { _all: 4 } },
      { campaign: "nuevo", status: "CLICKED", _count: { _all: 2 } },
      { campaign: "sin_ventas", status: "DECLINED", _count: { _all: 1 } },
    ]);
    const t = await buildDailySummary(new Date("2026-10-12T12:00:00Z"));
    expect(t).toContain("Saludos: 7 mostrados, 2 tocados, 1 rechazados");
    expect(t).toContain("nuevo: 6/2/0");
    expect(t).toContain("sin ventas: 1/0/1");
  });

  it("mails: cuenta sólo a quien entró después del envío", async () => {
    m.outFind.mockResolvedValue([
      { userId: 1, createdAt: new Date("2026-10-12T10:00:00Z") },
      { userId: 2, createdAt: new Date("2026-10-12T10:00:00Z") },
      { userId: 3, createdAt: new Date("2026-10-12T10:00:00Z") },
    ]);
    m.users.mockResolvedValue([
      { id: 1, lastLoginAt: new Date("2026-10-12T11:00:00Z") },
      { id: 2, lastLoginAt: new Date("2026-09-01T11:00:00Z") },
      { id: 3, lastLoginAt: null },
    ]);
    const t = await buildDailySummary(new Date("2026-10-12T12:00:00Z"));
    expect(t).toContain("Mails: 3 enviados; 1 de esos fotógrafos entraron después.");
  });

  it("primeras ventas: fotógrafos distintos, excluye a quien ya había vendido antes del mes", async () => {
    const primeras = (q: { distinct?: string[]; where: { userId?: unknown } }) => {
      if (!q.distinct) return Promise.resolve([]); // lineaEscolares
      return Promise.resolve(q.where.userId ? [{ userId: 2 }] : [{ userId: 1 }, { userId: 2 }, { userId: 3 }]);
    };
    m.albums.mockImplementation(primeras);
    const t = await buildDailySummary(new Date("2026-10-12T12:00:00Z"));
    expect(t).toContain("Primeras ventas este mes: 2 fotógrafos.");
    const llamadas = m.albums.mock.calls.map((c) => c[0]).filter((q) => q.distinct);
    expect(llamadas).toHaveLength(2);
    const [mes, antes] = llamadas;
    expect(mes.distinct).toEqual(["userId"]);
    expect(mes.take).toBe(500);
    const dentro = mes.where.orders.some;
    expect(dentro.createdAt.gte.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(dentro).toMatchObject({ status: "PAID", isTest: false, totalCents: { gt: 0 } });
    expect(antes.where.userId).toEqual({ in: [1, 2, 3] });
    expect(antes.where.orders.some.createdAt.lt.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(antes.where.orders.some).toMatchObject({ status: "PAID", isTest: false, totalCents: { gt: 0 } });
    expect(m.orders).not.toHaveBeenCalled();
  });

  it("primeras ventas: sin candidatos no hace la segunda consulta", async () => {
    await buildDailySummary(new Date("2026-10-12T12:00:00Z"));
    expect(m.albums.mock.calls.map((c) => c[0]).filter((q) => q.distinct)).toHaveLength(1);
  });

  it("escolares: cuenta el paso 9 hecho y acota la cantidad evaluada", async () => {
    m.albums.mockResolvedValue([
      { id: 10, userId: 1 },
      { id: 11, userId: 2 },
    ]);
    m.progreso
      .mockResolvedValueOnce({ pasos: [{ id: "preventa_publicada", estado: "hecho" }] })
      .mockResolvedValueOnce({ pasos: [{ id: "preventa_publicada", estado: "pendiente" }] });
    const t = await buildDailySummary(new Date("2026-10-12T12:00:00Z"));
    expect(t).toContain("Álbumes escolares con preventa publicada: 1.");
    expect(m.progreso).toHaveBeenCalledWith(1, 10, expect.any(Date));
    const q = m.albums.mock.calls.map((c) => c[0]).find((x) => !x.distinct);
    expect(q.take).toBe(50);
    expect(q.where.isTest).toBe(false);
    expect(q.where.deletedAt).toBeNull();
  });

  it("escolares: un álbum que falla no rompe el resumen", async () => {
    m.albums.mockResolvedValue([{ id: 10, userId: 1 }]);
    m.progreso.mockRejectedValueOnce(new Error("x"));
    const t = await buildDailySummary(new Date("2026-10-12T12:00:00Z"));
    expect(t).toContain("Álbumes escolares con preventa publicada: 0.");
  });
});
