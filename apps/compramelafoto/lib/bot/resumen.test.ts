import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ convCount: vi.fn(), convGroup: vi.fn(), actGroup: vi.fn(), incidents: vi.fn(), usage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    botConversation: { count: (...a: unknown[]) => m.convCount(...a), groupBy: (...a: unknown[]) => m.convGroup(...a) },
    botAction: { groupBy: (...a: unknown[]) => m.actGroup(...a) },
    botIncident: { findMany: (...a: unknown[]) => m.incidents(...a) },
    botUsageDaily: { aggregate: (...a: unknown[]) => m.usage(...a) },
  },
}));
import { buildDailySummary } from "./resumen";

beforeEach(() => {
  m.convCount.mockResolvedValue(10);
  m.convGroup.mockResolvedValue([{ status: "ESCALATED", _count: { _all: 2 } }]);
  m.actGroup.mockResolvedValue([{ status: "EXECUTED", _count: { _all: 5 } }]);
  m.incidents.mockResolvedValue([{ title: "album: P2002", occurrences: 3, urgent: true }]);
  m.usage.mockResolvedValue({ _sum: { costMicroUsd: 1_500_000 } });
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
});
