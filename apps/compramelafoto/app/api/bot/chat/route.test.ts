import { BotTurnError, type BotTurnInput } from "@repo/dnx-bot";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: vi.fn(), enabled: vi.fn(), snap: vi.fn(), turn: vi.fn(), conv: vi.fn(), hist: vi.fn(), append: vi.fn(),
  usage: vi.fn(), inc: vi.fn(), sit: vi.fn(), tools: vi.fn(), cap: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/config", () => ({
  isBotEnabledForUser: () => m.enabled(),
  readBotConfig: () => ({ enabled: true, model: "claude-sonnet-5-5", effort: "medium", maxIterations: 8, limits: { maxMessagesPerUserPerDay: 50, monthlyCapMicroUsd: 1 }, telegram: null, anthropicApiKey: "k" }),
}));
vi.mock("@/lib/bot/store", () => ({
  usageSnapshot: () => m.snap(), getOrCreateConversation: () => m.conv(), loadHistory: () => m.hist(),
  appendMessages: (...a: unknown[]) => m.append(...a), recordUsage: (...a: unknown[]) => m.usage(...a), createPendingAction: vi.fn(),
}));
vi.mock("@/lib/bot/tope", () => ({ notifyCapThresholds: (...a: unknown[]) => m.cap(...a) }));
vi.mock("@/lib/bot/escalamiento", () => ({ reportIncident: (...a: unknown[]) => m.inc(...a) }));
vi.mock("@/lib/bot/contexto", () => ({ buildPhotographerSituation: (...a: unknown[]) => m.sit(...a) }));
vi.mock("@/lib/bot/anthropic", () => ({ getAnthropicClient: () => ({}) }));
vi.mock("@/lib/bot/herramientas", () => ({ toolsForActor: (...a: unknown[]) => { m.tools(...a); return []; } }));
vi.mock("@/lib/bot/guia", () => ({ buildSystemGuide: () => "GUIA" }));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), runBotTurn: (...a: unknown[]) => m.turn(...a) }));
import { POST } from "./route";

const req = (text: string) => new Request("http://x/api/bot/chat", { method: "POST", body: JSON.stringify({ text }) });
const read = async (res: Response) => await res.text();
const okTurn = async (i: Pick<BotTurnInput, "onText">) => {
  i.onText("Hola");
  return {
    appended: [{ role: "user", content: "hola" }, { role: "assistant", content: [{ type: "text", text: "Hola" }] }],
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    outcome: "ok",
  };
};
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.user.mockResolvedValue({ id: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" });
  m.enabled.mockResolvedValue(true);
  m.conv.mockResolvedValue({ id: "c1" });
  m.hist.mockResolvedValue([]);
  m.sit.mockResolvedValue({ text: "SIT", alerts: [] });
  m.inc.mockResolvedValue(undefined);
  m.cap.mockResolvedValue(undefined);
});

describe("POST /api/bot/chat", () => {
  it("sin sesión → 401", async () => {
    m.user.mockResolvedValue(null);
    expect((await POST(req("hola"))).status).toBe(401);
  });
  it("apagado para el usuario → 404", async () => {
    m.enabled.mockResolvedValue(false);
    expect((await POST(req("hola"))).status).toBe(404);
  });
  it("mensaje vacío → 400", async () => {
    expect((await POST(req("   "))).status).toBe(400);
  });
  it("tope alcanzado → no llama a la API y ofrece ticket", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 5 });
    const body = await read(await POST(req("hola")));
    expect(m.turn).not.toHaveBeenCalled();
    expect(body).toContain("event: error");
    expect(body).toContain("offerTicket");
  });
  it("falla de la API → error amable, incidente registrado, nada a medio guardar", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    m.turn.mockRejectedValue(new Error("overloaded"));
    const body = await read(await POST(req("hola")));
    expect(body).toContain("event: error");
    expect(body).toContain("offerTicket");
    expect(m.append).not.toHaveBeenCalled();
    expect(m.usage).not.toHaveBeenCalled();
    expect(m.inc).toHaveBeenCalled();
  });
  it("turno normal → guarda lo agregado y el uso", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    m.turn.mockImplementation(okTurn);
    const body = await read(await POST(req("hola")));
    expect(body).toContain("event: text");
    expect(body).toContain("event: done");
    expect(body).not.toContain("event: error");
    expect(m.append).toHaveBeenCalledWith("c1", expect.any(Array));
    expect(m.usage).toHaveBeenCalled();
    expect(m.cap).toHaveBeenCalledTimes(1);
    expect(m.turn.mock.calls[0]![0]).toEqual(expect.objectContaining({ systemGuide: "GUIA", situation: "SIT" }));
  });
  it("turno cortado (refusal) → guarda lo agregado, registra incidente y ofrece ticket", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    m.turn.mockResolvedValue({ appended: [{ role: "user", content: "hola" }], usage: { input_tokens: 1, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, outcome: "refusal" });
    const body = await read(await POST(req("hola")));
    expect(m.append).toHaveBeenCalledWith("c1", [{ role: "user", content: "hola" }]);
    expect(m.inc).toHaveBeenCalledWith(expect.objectContaining({ codigo: "turno_refusal" }));
    expect(body).toContain("offerTicket");
    expect(body).toContain("event: done");
  });
  it("usuario que no es fotógrafo → no arma la situación de fotógrafo", async () => {
    m.user.mockResolvedValue({ id: 8, role: "CLIENT", email: "c@x.com", name: "C" });
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    m.turn.mockImplementation(okTurn);
    await read(await POST(req("hola")));
    expect(m.sit).not.toHaveBeenCalled();
    expect(typeof m.turn.mock.calls[0]![0].situation).toBe("string");
    expect(m.turn.mock.calls[0]![0].situation).not.toBe("SIT");
  });
  it("si el cliente corta la conexión a mitad del texto, el turno igual se guarda", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    const box: { res?: Response } = {};
    m.turn.mockImplementation(async (i: BotTurnInput) => {
      await box.res!.body!.cancel();
      i.onText("Hola");
      return okTurn({ onText: () => {} });
    });
    box.res = await POST(req("hola"));
    await new Promise((r) => setTimeout(r, 20));
    await vi.waitFor(() => expect(m.usage).toHaveBeenCalled());
    expect(m.append).toHaveBeenCalledWith("c1", expect.any(Array));
  });
  it("falla de la API a mitad del turno → cobra el uso parcial sin guardar mensajes", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    const partial = { input_tokens: 500, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    const cause = new Error("overloaded");
    cause.name = "APIError";
    m.turn.mockRejectedValue(new BotTurnError(cause, partial));
    const body = await read(await POST(req("hola")));
    expect(body).toContain("offerTicket");
    expect(m.append).not.toHaveBeenCalled();
    expect(m.usage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "c1", usage: partial, countMessage: true }));
    expect(m.usage.mock.calls[0]![0].costMicroUsd).toBeGreaterThan(0);
    expect(m.cap).toHaveBeenCalledTimes(1);
    expect(m.inc).toHaveBeenCalledWith(expect.objectContaining({ codigo: "api_APIError", detalle: "overloaded" }));
  });
  it("pasa un plazo de ~95 s al motor y el texto del turno a las herramientas", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    m.turn.mockImplementation(okTurn);
    const before = Date.now();
    await read(await POST(req("hola")));
    const d = m.turn.mock.calls[0]![0].deadlineMs as number;
    expect(d).toBeGreaterThanOrEqual(before + 95_000);
    expect(d).toBeLessThanOrEqual(Date.now() + 95_000);
    expect(m.tools).toHaveBeenCalledWith(expect.objectContaining({ userId: 7 }), { conversationId: "c1", currentUserText: "hola" });
  });
});
