import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  usoAgg: vi.fn(), convCount: vi.fn(), convFind: vi.fn(), orderAgg: vi.fn(), orderFind: vi.fn(), albumFind: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    botUsageDaily: { aggregate: (...a: unknown[]) => m.usoAgg(...a) },
    botConversation: { count: (...a: unknown[]) => m.convCount(...a), findMany: (...a: unknown[]) => m.convFind(...a) },
    order: { aggregate: (...a: unknown[]) => m.orderAgg(...a), findMany: (...a: unknown[]) => m.orderFind(...a) },
    album: { findMany: (...a: unknown[]) => m.albumFind(...a) },
  },
}));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF" }));
import { juntarDatos, VENTANA_FOTOGRAFOS_MS, ventasFotografosPosteriores } from "./reporte";

const t = (iso: string) => new Date(iso);

describe("ventasFotografosPosteriores", () => {
  const convs = [{ userId: 1, createdAt: t("2026-10-13T15:00:00Z") }, { userId: 2, createdAt: t("2026-10-14T15:00:00Z") }];
  it("cuenta pedidos del mismo fotógrafo dentro de los 30 días posteriores", () => {
    const r = ventasFotografosPosteriores(convs, [
      { userId: 1, totalCents: 1000, createdAt: t("2026-10-20T00:00:00Z") },
      { userId: 1, totalCents: 500, createdAt: t("2026-11-01T00:00:00Z") },
      { userId: 1, totalCents: 9, createdAt: t("2026-10-13T14:00:00Z") }, // antes de hablar
      { userId: 2, totalCents: 7, createdAt: new Date(t("2026-10-14T15:00:00Z").getTime() + VENTANA_FOTOGRAFOS_MS + 1) }, // fuera de ventana
      { userId: 3, totalCents: 99, createdAt: t("2026-10-20T00:00:00Z") }, // no habló con el bot
    ]);
    expect(r).toEqual({ vendieron: 1, pedidos: 2, pesos: 1500 });
  });
});

describe("juntarDatos", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.usoAgg.mockImplementation(({ where }: { where: { actorKey?: { startsWith: string } } }) =>
      Promise.resolve({ _sum: { costMicroUsd: where.actorKey?.startsWith === "u:" ? 3_000_000 : where.actorKey ? 1_000_000 : 4_000_000, messages: 10 } }));
    m.convCount.mockResolvedValue(5);
    m.convFind.mockResolvedValue([]);
    m.orderAgg.mockResolvedValue({ _count: { _all: 2 }, _sum: { totalCents: 20_000 } });
    m.orderFind.mockResolvedValue([]);
    m.albumFind.mockResolvedValue([]);
  });
  it("fin de semana: filtra BotUsageDaily por días argentinos y ventas por instantes", async () => {
    const d = await juntarDatos("fin_de_semana", t("2026-10-18T13:00:00Z"), async () => null);
    expect(d.costoTotalMicroUsd).toBe(4_000_000);
    expect(d.fotografos).toEqual({ costoMicroUsd: 3_000_000, conversaciones: 5, mensajes: 10 });
    expect(d.compradores.costoMicroUsd).toBe(1_000_000);
    expect(d.promedioPrevios).toBeUndefined();
    expect(d.parcial).toBe(false);
    expect(m.usoAgg.mock.calls[0]![0].where.day).toEqual({ gte: "2026-10-12", lte: "2026-10-17" });
    const ventas = m.orderAgg.mock.calls.map((c) => c[0].where);
    expect(ventas[0]).toMatchObject({ status: "PAID", isTest: false, totalCents: { gt: 0 } });
    expect(ventas[0].createdAt.gte.toISOString()).toBe("2026-10-12T03:00:00.000Z");
    expect(ventas[1].createdAt.gte.toISOString()).toBe("2026-10-06T03:00:00.000Z");
  });
  it("mensual: suma el promedio de los 3 meses anteriores", async () => {
    const d = await juntarDatos("mensual", t("2026-11-01T13:00:00Z"), async () => ({ pesosPorDolar: 1500, fuente: "dolarapi" }));
    expect(d.promedioPrevios).toEqual({ pedidos: 2, pesos: 20_000 });
    expect(m.orderAgg).toHaveBeenCalledTimes(5);
    expect(d.cotizacion?.pesosPorDolar).toBe(1500);
  });
});
