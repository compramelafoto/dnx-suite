import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  conv: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  msg: { findMany: vi.fn(), aggregate: vi.fn(), createMany: vi.fn() },
  usage: { upsert: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
  action: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  incident: { findUnique: vi.fn(), upsert: vi.fn() },
  tx: vi.fn(),
  raw: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    botConversation: m.conv, botMessage: m.msg, botUsageDaily: m.usage, botAction: m.action, botIncident: m.incident,
    $transaction: (fn: any) => fn({ botMessage: m.msg, $queryRaw: m.raw }),
  },
}));
import { appendMessages, claimPendingAction, getOrCreateConversation, usageSnapshot } from "./store";

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
  it("claimPendingAction: si gana el updateMany devuelve la fila", async () => {
    m.action.updateMany.mockResolvedValue({ count: 1 });
    const row = { id: "a1", userId: 1, toolName: "t", input: {}, summary: "s", conversationId: "c1" };
    m.action.findUnique.mockResolvedValue(row);
    expect(await claimPendingAction("a1", 1)).toEqual(row);
  });
  it("appendMessages bloquea la conversación antes de calcular seq y numera desde max+1", async () => {
    m.msg.aggregate.mockResolvedValue({ _max: { seq: 4 } });
    await appendMessages("c1", [{ role: "user", content: "a" }, { role: "assistant", content: "b" }]);
    expect(m.raw.mock.invocationCallOrder[0]).toBeLessThan(m.msg.aggregate.mock.invocationCallOrder[0]!);
    expect(m.msg.createMany.mock.calls[0]![0].data.map((d: any) => d.seq)).toEqual([5, 6]);
  });
  it("appendMessages arranca en 0 si no hay mensajes", async () => {
    m.msg.aggregate.mockResolvedValue({ _max: { seq: null } });
    await appendMessages("c1", [{ role: "user", content: "a" }]);
    expect(m.msg.createMany.mock.calls[0]![0].data[0].seq).toBe(0);
  });
});
