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
import { HARD_CAP_TURNS } from "@repo/dnx-bot";
import { appendMessages, claimPendingAction, continueConversation, getOrCreateConversation, recordUsage, usageSnapshot } from "./store";

beforeEach(() => Object.values(m).forEach((g: any) => typeof g === "function" ? g.mockReset() : Object.values(g).forEach((f: any) => f.mockReset())));

describe("store", () => {
  it("reusa la conversación abierta o escalada de las últimas 6 horas", async () => {
    m.conv.findFirst.mockResolvedValue({ id: "c1", status: "ESCALATED", supportTicketId: 9, _count: { messages: 12 } });
    expect(await getOrCreateConversation({ userId: 1, pagePath: "/x", model: "m" })).toEqual({ id: "c1", status: "ESCALATED", supportTicketId: 9 });
    expect(m.conv.create).not.toHaveBeenCalled();
    expect(m.conv.findFirst.mock.calls[0]![0].where.status).toEqual({ in: ["OPEN", "ESCALATED"] });
  });
  it("crea una nueva si no hay", async () => {
    m.conv.findFirst.mockResolvedValue(null);
    m.conv.create.mockResolvedValue({ id: "c2", status: "OPEN", supportTicketId: null });
    expect(await getOrCreateConversation({ userId: 1, pagePath: "/x", model: "m" })).toEqual({ id: "c2", status: "OPEN", supportTicketId: null });
  });
  it("una conversación larga se sigue usando: ya no se corta a los 40 mensajes (el bot perdía el contexto)", async () => {
    m.conv.findFirst.mockResolvedValueOnce({ id: "c1", status: "OPEN", supportTicketId: null });
    expect((await getOrCreateConversation({ userId: 1, pagePath: null, model: "m" })).id).toBe("c1");
    expect(m.conv.create).not.toHaveBeenCalled();
    expect(m.conv.findFirst.mock.calls[0]![0].select).not.toHaveProperty("_count");
  });
  it("continueConversation: debajo del tope duro (en turnos), la misma conversación con su historial", async () => {
    const filas = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    m.msg.findMany.mockResolvedValue(filas);
    const r = await continueConversation({ id: "c1", status: "OPEN", supportTicketId: null }, { userId: 1, pagePath: null, model: "m" });
    expect(r.conv.id).toBe("c1");
    expect(r.history).toHaveLength(60);
    expect(m.conv.create).not.toHaveBeenCalled();
  });
  it("continueConversation: pasado el tope duro abre otra con el resumen de la anterior y conserva el ticket", async () => {
    const filas = Array.from({ length: HARD_CAP_TURNS }, (_, i) => [{ role: "user", content: `pedido ${i + 1}` }, { role: "assistant", content: "ok" }]).flat();
    m.msg.findMany.mockResolvedValue(filas);
    m.msg.aggregate.mockResolvedValue({ _max: { seq: null } });
    m.conv.create.mockResolvedValue({ id: "c2", status: "ESCALATED", supportTicketId: 9 });
    const r = await continueConversation({ id: "c1", status: "ESCALATED", supportTicketId: 9 }, { userId: 1, pagePath: null, model: "m" });
    expect(r.conv.id).toBe("c2");
    expect(m.conv.create.mock.calls[0]![0].data).toMatchObject({ platform: "CLF", userId: 1, status: "ESCALATED", supportTicketId: 9 });
    const arrastre = m.msg.createMany.mock.calls[0]![0].data[0];
    expect(arrastre).toMatchObject({ conversationId: "c2", seq: 0, role: "user" });
    expect(arrastre.content).toMatch(/^\[Sistema\]/);
    expect(arrastre.content).toContain(`pedido ${HARD_CAP_TURNS}`);
    expect(r.history).toEqual([{ role: "user", content: arrastre.content }]);
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
  it("sólo continúa conversaciones de fotógrafos", async () => {
    m.conv.findFirst.mockResolvedValue(null);
    m.conv.create.mockResolvedValue({ id: "c9", status: "OPEN", supportTicketId: null });
    await getOrCreateConversation({ userId: 1, pagePath: null, model: "m" });
    expect(m.conv.findFirst.mock.calls[0]![0].where.audience).toBe("PHOTOGRAPHER");
  });
  it("usageSnapshot lee el día por actorKey u:<userId>", async () => {
    m.usage.findUnique.mockResolvedValue({ messages: 2 });
    m.usage.aggregate.mockResolvedValue({ _sum: { costMicroUsd: 0 } });
    await usageSnapshot(7);
    expect(m.usage.findUnique.mock.calls[0]![0].where.platform_day_actorKey).toMatchObject({ actorKey: "u:7" });
  });
  it("recordUsage hace upsert por actorKey y guarda userId", async () => {
    m.usage.upsert.mockResolvedValue({});
    m.conv.update.mockResolvedValue({});
    await recordUsage({ userId: 7, conversationId: "c1", usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, costMicroUsd: 5, countMessage: true });
    const arg = m.usage.upsert.mock.calls[0]![0];
    expect(arg.where.platform_day_actorKey.actorKey).toBe("u:7");
    expect(arg.create).toMatchObject({ userId: 7, actorKey: "u:7", messages: 1, costMicroUsd: 5 });
  });
  it("recordUsage: si la fila del día ya existe, suma (update por incrementos)", async () => {
    m.usage.upsert.mockResolvedValue({});
    m.conv.update.mockResolvedValue({});
    await recordUsage({ userId: 7, conversationId: "c1", usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, costMicroUsd: 5, countMessage: false });
    expect(m.usage.upsert.mock.calls[0]![0].update).toEqual({
      messages: { increment: 0 },
      inputTokens: { increment: 10 },
      outputTokens: { increment: 20 },
      costMicroUsd: { increment: 5 },
    });
  });
});
