import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  conv: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  msg: { findMany: vi.fn(), aggregate: vi.fn(), createMany: vi.fn() },
  usage: { upsert: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
  action: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  incident: { findUnique: vi.fn(), upsert: vi.fn() },
  tx: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    botConversation: m.conv, botMessage: m.msg, botUsageDaily: m.usage, botAction: m.action, botIncident: m.incident,
    $transaction: (fn: any) => fn({ botMessage: m.msg }),
  },
}));
import { claimPendingAction, getOrCreateConversation, usageSnapshot } from "./store";

beforeEach(() => Object.values(m).forEach((g: any) => typeof g === "function" ? g.mockReset() : Object.values(g).forEach((f: any) => f.mockReset())));

describe("store", () => {
  it("reusa la conversación abierta de las últimas 6 horas", async () => {
    m.conv.findFirst.mockResolvedValue({ id: "c1" });
    expect(await getOrCreateConversation({ userId: 1, pagePath: "/x", model: "m" })).toEqual({ id: "c1" });
    expect(m.conv.create).not.toHaveBeenCalled();
  });
  it("crea una nueva si no hay", async () => {
    m.conv.findFirst.mockResolvedValue(null);
    m.conv.create.mockResolvedValue({ id: "c2" });
    expect(await getOrCreateConversation({ userId: 1, pagePath: "/x", model: "m" })).toEqual({ id: "c2" });
  });
  it("claimPendingAction es atómico: sólo gana un updateMany con count 1", async () => {
    m.action.updateMany.mockResolvedValue({ count: 0 });
    expect(await claimPendingAction("a1", 1)).toBeNull();
    const where = m.action.updateMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ id: "a1", userId: 1, status: "PENDING" });
    expect(where.expiresAt).toBeDefined();
  });
  it("usageSnapshot suma el mes de la plataforma y lee el día del usuario", async () => {
    m.usage.findUnique.mockResolvedValue({ messages: 3 });
    m.usage.aggregate.mockResolvedValue({ _sum: { costMicroUsd: 1234 } });
    expect(await usageSnapshot(1)).toEqual({ userMessagesToday: 3, monthMicroUsd: 1234 });
  });
});
