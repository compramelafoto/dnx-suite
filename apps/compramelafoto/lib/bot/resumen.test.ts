import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";

const m = vi.hoisted(() => ({
  convCount: vi.fn(), convGroup: vi.fn(), actGroup: vi.fn(), actFind: vi.fn(), incidents: vi.fn(), usage: vi.fn(), orders: vi.fn(), orderRows: vi.fn(),
  outGroup: vi.fn(), outFind: vi.fn(), users: vi.fn(), albums: vi.fn(), progreso: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    botConversation: { count: (...a: unknown[]) => m.convCount(...a), groupBy: (...a: unknown[]) => m.convGroup(...a) },
    botAction: { groupBy: (...a: unknown[]) => m.actGroup(...a), findMany: (...a: unknown[]) => m.actFind(...a) },
    botIncident: { findMany: (...a: unknown[]) => m.incidents(...a) },
    botUsageDaily: { aggregate: (...a: unknown[]) => m.usage(...a) },
    botOutreach: { groupBy: (...a: unknown[]) => m.outGroup(...a), findMany: (...a: unknown[]) => m.outFind(...a) },
    user: { findMany: (...a: unknown[]) => m.users(...a) },
    order: { aggregate: (...a: unknown[]) => m.orders(...a), findMany: (...a: unknown[]) => m.orderRows(...a) },
    album: { findMany: (...a: unknown[]) => m.albums(...a) },
  },
}));
vi.mock("@/lib/bot/escolar/progreso", () => ({ computeSchoolSetupProgress: (...a: unknown[]) => m.progreso(...a) }));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF", readBotConfig: () => ({ limits: { monthlyCapMicroUsd: 30_000_000 } }) }));
import { buildDailySummary, salesWindows } from "./resumen";

type Where = { status?: string; isTest?: boolean; totalCents?: { gt: number }; createdAt?: { gte?: Date; lt?: Date; gt?: Date }; albumId?: number | { in: number[] }; OR?: Where[] };
type FakeOrder = { albumId: number; status: string; isTest: boolean; totalCents: number; createdAt: Date };

/** Evalúa el `where` de prisma.order.aggregate sobre pedidos en memoria (sólo lo que usa el resumen). */
function matches(o: FakeOrder, w: Where): boolean {
  if (w.status && o.status !== w.status) return false;
  if (w.isTest !== undefined && o.isTest !== w.isTest) return false;
  if (w.totalCents && !(o.totalCents > w.totalCents.gt)) return false;
  if (typeof w.albumId === "number" && o.albumId !== w.albumId) return false;
  if (typeof w.albumId === "object" && !w.albumId.in.includes(o.albumId)) return false;
  const c = w.createdAt;
  if (c?.gte && o.createdAt < c.gte) return false;
  if (c?.lt && !(o.createdAt < c.lt)) return false;
  if (c?.gt && !(o.createdAt > c.gt)) return false;
  if (w.OR && !w.OR.some((x) => matches(o, x))) return false;
  return true;
}
let orders: FakeOrder[] = [];
const paid = (pesos: number, iso: string, extra: Partial<FakeOrder> = {}): FakeOrder => ({
  albumId: 1, status: "PAID", isTest: false, totalCents: pesos, createdAt: new Date(iso), ...extra,
});

beforeEach(() => {
  orders = [];
  Object.values(m).forEach((f) => f.mockReset());
  m.convCount.mockResolvedValue(10);
  m.convGroup.mockResolvedValue([{ status: "ESCALATED", _count: { _all: 2 } }]);
  m.actGroup.mockResolvedValue([{ status: "EXECUTED", _count: { _all: 5 } }]);
  m.actFind.mockResolvedValue([]);
  m.incidents.mockResolvedValue([{ title: "album: P2002", occurrences: 3, urgent: true }]);
  m.usage.mockResolvedValue({ _sum: { costMicroUsd: 1_500_000 } });
  m.outGroup.mockResolvedValue([]);
  m.outFind.mockResolvedValue([]);
  m.users.mockResolvedValue([]);
  m.albums.mockResolvedValue([]);
  m.orders.mockImplementation(async (a: { where: Where }) => {
    const hit = orders.filter((o) => matches(o, a.where));
    return { _count: { _all: hit.length }, _sum: { totalCents: hit.length ? hit.reduce((s, o) => s + o.totalCents, 0) : null } };
  });
  m.orderRows.mockImplementation(async (a: { where: Where }) => orders.filter((o) => matches(o, a.where)));
});

const NOW = new Date("2026-10-12T12:00:00Z"); // 12/10 09:00 en Argentina

describe("salesWindows", () => {
  it("usa medianoche argentina y el mismo día y hora del mes anterior", () => {
    const w = salesWindows(NOW);
    expect(w.currentStart.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(w.previousStart.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(w.previousEnd.toISOString()).toBe("2026-09-12T12:00:00.000Z");
  });
  it("31/10 → el período anterior termina con el 30/09 completo", () => {
    const w = salesWindows(new Date("2026-10-31T20:00:00Z"));
    expect(w.previousEnd.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });
  it("de noche en Argentina (ya otro día en UTC) sigue siendo el mes argentino", () => {
    const w = salesWindows(new Date("2026-11-01T02:30:00Z")); // 31/10 23:30 AR
    expect(w.currentStart.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(w.previousEnd.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });
});

describe("buildDailySummary", () => {
  it("incluye conversaciones, derivadas, acciones, errores y gasto en dólares aclarado contra el tope", async () => {
    const t = await buildDailySummary(NOW);
    expect(t).toContain("10 conversaciones");
    expect(t).toContain("2 derivadas");
    expect(t).toContain("5 acciones");
    expect(t).toContain("album: P2002 (×3)");
    expect(t).toContain("Gasto del bot este mes: USD 1,50 de USD 30 (se factura en dólares).");
    expect(t).toContain("2026-10-12");
  });

  it("sin errores ni gasto lo dice", async () => {
    m.incidents.mockResolvedValue([]);
    m.usage.mockResolvedValue({ _sum: { costMicroUsd: null } });
    const t = await buildDailySummary(NOW);
    expect(t).toContain("Sin errores del sistema");
    expect(t).toContain("USD 0,00 de USD 30");
  });

  it("ventas del mes contra el mismo período: excluye $0, pruebas, impagos y lo posterior al mismo día", async () => {
    orders = [
      paid(10_000, "2026-10-01T03:00:00Z"), // 1/10 00:00 AR: entra
      paid(5_000, "2026-10-12T11:00:00Z"),
      paid(0, "2026-10-05T15:00:00Z"), // $0: no cuenta
      paid(99_000, "2026-10-05T15:00:00Z", { isTest: true }),
      paid(99_000, "2026-10-05T15:00:00Z", { status: "PENDING" }),
      paid(77_000, "2026-10-01T02:59:00Z"), // 30/09 23:59 AR: mes anterior
      paid(3_000, "2026-09-12T11:59:00Z"),
      paid(50_000, "2026-09-20T15:00:00Z"), // después del 12/09: fuera del período comparable
    ];
    const t = await buildDailySummary(NOW);
    expect(t).toContain(
      `Ventas del mes hasta hoy: 2 pedidos, ${formatPurchaseArs(15_000)} (mismo período del mes anterior: 1 pedido, ${formatPurchaseArs(3_000)}; +400 %).`,
    );
  });

  it("baja contra el mes anterior → porcentaje negativo", async () => {
    orders = [paid(1_000, "2026-10-02T15:00:00Z"), paid(4_000, "2026-09-02T15:00:00Z")];
    const t = await buildDailySummary(NOW);
    expect(t).toContain("; -75 %).");
  });

  it("sin ventas en el mismo período del mes anterior lo dice en vez de un porcentaje", async () => {
    orders = [paid(1_234_567, "2026-10-02T15:00:00Z"), paid(0, "2026-09-02T15:00:00Z")];
    const t = await buildDailySummary(NOW);
    expect(t).toContain(`Ventas del mes hasta hoy: 1 pedido, ${formatPurchaseArs(1_234_567)} (sin ventas el mes anterior en el mismo período).`);
    expect(formatPurchaseArs(1_234_567)).toMatch(/1\.234\.567/);
  });

  it("álbumes destrabados: distintos, desde la primera acción del mes, sólo herramientas que destraban", async () => {
    m.actFind.mockResolvedValue([
      { input: { albumId: 1, cambios: {} }, decidedAt: new Date("2026-10-05T12:00:00Z") },
      { input: { albumId: 1, dias: 30 }, decidedAt: new Date("2026-10-03T12:00:00Z") },
      { input: { albumId: 2, precio: 100 }, decidedAt: new Date("2026-10-08T12:00:00Z") },
      { input: { nada: true }, decidedAt: new Date("2026-10-08T12:00:00Z") },
    ]);
    orders = [
      paid(8_000, "2026-10-04T12:00:00Z", { albumId: 1 }), // después de la primera acción (3/10)
      paid(9_000, "2026-10-02T12:00:00Z", { albumId: 1 }), // antes: no cuenta
      paid(2_000, "2026-10-09T12:00:00Z", { albumId: 2 }),
      paid(0, "2026-10-09T12:00:00Z", { albumId: 2 }),
      paid(7_000, "2026-10-09T12:00:00Z", { albumId: 3 }), // álbum que el bot no tocó
    ];
    const t = await buildDailySummary(NOW);
    expect(t).toContain(`Álbumes destrabados por el bot: 2 (ventas desde que el bot los cambió: ${formatPurchaseArs(10_000)}).`);
    const where = m.actFind.mock.calls[0]![0].where;
    expect(where).toMatchObject({ platform: "CLF", status: "EXECUTED", decidedAt: { gte: new Date("2026-10-01T03:00:00Z") } });
    expect(m.orderRows.mock.calls[0]![0].where).toMatchObject({ albumId: { in: [1, 2] }, createdAt: { gt: new Date("2026-10-03T12:00:00Z") } });
    expect(where.toolName.in).toEqual(["actualizar_album", "configurar_venta_por_reconocimiento", "crear_pack_digital", "editar_pack", "extender_vencimiento"]);
  });

  it("sin acciones que destraben → 0 y no consulta pedidos de más", async () => {
    const t = await buildDailySummary(NOW);
    expect(t).toContain(`Álbumes destrabados por el bot: 0 (ventas desde que el bot los cambió: ${formatPurchaseArs(0)}).`);
    expect(m.orders).toHaveBeenCalledTimes(2);
    expect(m.orderRows).not.toHaveBeenCalled();
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
    expect(m.orderRows).not.toHaveBeenCalled();
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
