import { BotTurnError, type BotTurnInput } from "@repo/dnx-bot";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: vi.fn(), enabled: vi.fn(), snap: vi.fn(), turn: vi.fn(), conv: vi.fn(), hist: vi.fn(), append: vi.fn(),
  usage: vi.fn(), inc: vi.fn(), sit: vi.fn(), tools: vi.fn(), cap: vi.fn(), after: [] as (() => Promise<void>)[],
  caso: vi.fn(), evento: vi.fn(), espejar: vi.fn(),
}));
// Aparte de `m`: el beforeEach resetea las funciones de `m`. Tope 1 en los casos de siempre.
const cfg = vi.hoisted(() => ({ cap: 1 }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/config", () => ({
  isBotEnabledForUser: () => m.enabled(),
  readBotConfig: () => ({ enabled: true, model: "claude-sonnet-5-5", effort: "medium", maxIterations: 8, limits: { maxMessagesPerUserPerDay: 50, monthlyCapMicroUsd: cfg.cap }, telegram: null, anthropicApiKey: "k" }),
}));
vi.mock("@/lib/bot/store", () => ({
  usageSnapshot: () => m.snap(), getOrCreateConversation: () => m.conv(), loadHistory: () => m.hist(),
  continueConversation: async (conv: unknown) => ({ conv, history: await m.hist(), rotated: false }),
  appendMessages: (...a: unknown[]) => m.append(...a), recordUsage: (...a: unknown[]) => m.usage(...a), createPendingAction: vi.fn(),
}));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => m.after.push(fn) }));
vi.mock("@/lib/bot/tope", () => ({ notifyCapThresholds: (...a: unknown[]) => m.cap(...a) }));
vi.mock("@/lib/bot/escalamiento", () => ({ reportIncident: (...a: unknown[]) => m.inc(...a) }));
vi.mock("@/lib/bot/contexto", () => ({ buildPhotographerSituation: (...a: unknown[]) => m.sit(...a) }));
vi.mock("@/lib/bot/anthropic", () => ({ getAnthropicClient: () => ({}) }));
vi.mock("@/lib/bot/herramientas", () => ({ toolsForActor: (...a: unknown[]) => { m.tools(...a); return []; } }));
vi.mock("@/lib/bot/guia", () => ({ buildSystemGuide: () => "GUIA" }));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), runBotTurn: (...a: unknown[]) => m.turn(...a) }));
vi.mock("@/lib/soporte/caso-bot", () => ({
  casoParaFotografo: (...a: unknown[]) => m.caso(...a),
  situacionDeCaso: async () => "SIT_CASO",
  herramientasDeCaso: () => [{ name: "cerrar_caso_resuelto", kind: "read" }],
  espejarTurnoEnTicket: (...a: unknown[]) => m.espejar(...a),
}));
vi.mock("@/lib/soporte/aplicar-evento", () => ({ aplicarEvento: (...a: unknown[]) => m.evento(...a) }));
import { POST } from "./route";

const req = (text: string) => new Request("http://x/api/bot/chat", { method: "POST", body: JSON.stringify({ text }) });
const read = async (res: Response) => await res.text();
const runAfter = async () => { for (const fn of m.after.splice(0)) await fn(); };
const okTurn = async (i: Pick<BotTurnInput, "onText">) => {
  i.onText("Hola");
  return {
    appended: [{ role: "user", content: "hola" }, { role: "assistant", content: [{ type: "text", text: "Hola" }] }],
    usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    outcome: "ok",
  };
};
beforeEach(() => {
  cfg.cap = 1;
  Object.values(m).forEach((f) => (Array.isArray(f) ? f.splice(0) : f.mockReset()));
  m.user.mockResolvedValue({ id: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" });
  m.enabled.mockResolvedValue(true);
  m.conv.mockResolvedValue({ id: "c1" });
  m.hist.mockResolvedValue([]);
  m.sit.mockResolvedValue({ text: "SIT", alerts: [] });
  m.inc.mockResolvedValue(undefined);
  m.cap.mockResolvedValue(undefined);
});

const reqCaso = (text: string, casoToken: string) => new Request("http://x/api/bot/chat", { method: "POST", body: JSON.stringify({ text, casoToken }) });
describe("POST /api/bot/chat · modo caso", () => {
  it("link de un caso de otra cuenta → 403; vencido → 410; sin llamar al modelo", async () => {
    m.caso.mockResolvedValueOnce({ error: "ajeno" }).mockResolvedValueOnce({ error: "vencido" });
    expect((await POST(reqCaso("hola", "tok"))).status).toBe(403);
    const vencido = await POST(reqCaso("hola", "tok"));
    expect(vencido.status).toBe(410);
    expect(await vencido.json()).toEqual({ error: "caso_vencido" });
    expect(m.turn).not.toHaveBeenCalled();
    expect(m.caso).toHaveBeenCalledWith("tok", { id: 7, email: "f@x.com" });
  });
  it("caso propio: sigue la conversación del caso con su contexto y lo copia al ticket", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    cfg.cap = 30_000_000;
    m.caso.mockResolvedValue({ ticketId: 55, conversationId: "cs5" });
    m.turn.mockImplementation(okTurn);
    const body = await read(await POST(reqCaso("sigue igual", "tok")));
    expect(body).toContain("event: done");
    expect(m.conv).not.toHaveBeenCalled();
    const input = m.turn.mock.calls[0]![0] as BotTurnInput;
    expect(input.situation).toContain("SIT_CASO");
    expect(input.tools.map((t) => t.name)).toContain("cerrar_caso_resuelto");
    expect(m.evento).toHaveBeenCalledWith(55, { tipo: "CLIENTE_ESCRIBIO_BOT" });
    expect(m.append.mock.calls[0]![0]).toBe("cs5");
    expect(m.espejar.mock.calls[0]![1]).toMatchObject({ textoUsuario: "sigue igual", textoBot: "Hola" });
  });
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
  it("gasto en el 85 % del tope (compradores ya cortados) → fotógrafos siguen respondiendo", async () => {
    cfg.cap = 30_000_000;
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 25_500_000 });
    m.turn.mockImplementation(okTurn);
    const body = await read(await POST(req("hola")));
    expect(m.turn).toHaveBeenCalled();
    expect(body).toContain("event: done");
    expect(body).not.toContain("event: error");
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
    await runAfter();
    expect(m.cap).toHaveBeenCalledTimes(1);
    expect(m.turn.mock.calls[0]![0]).toEqual(expect.objectContaining({ systemGuide: "GUIA", situation: "SIT" }));
  });
  it("conversación larga → misma conversación; al modelo van los últimos turnos y lo anterior va resumido en la situación", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    m.turn.mockImplementation(okTurn);
    const largo = Array.from({ length: 50 }, (_, i) => [{ role: "user", content: `pregunta ${i + 1}` }, { role: "assistant", content: [{ type: "text", text: "ok" }] }]).flat();
    m.hist.mockResolvedValue(largo);
    await read(await POST(req("hola")));
    const input = m.turn.mock.calls[0]![0] as BotTurnInput;
    expect(input.history.length).toBeLessThan(largo.length);
    expect((input.history[0] as { role: string }).role).toBe("user");
    expect(input.history.at(-2)).toEqual({ role: "user", content: "pregunta 50" });
    expect(input.situation.startsWith("SIT")).toBe(true);
    expect(input.situation).toContain("«pregunta 20»");
    expect(m.append).toHaveBeenCalledWith("c1", expect.any(Array));
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
    await runAfter();
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
  it("ver_progreso_escolar con éxito → evento progreso con los datos; otras lecturas o fallas no", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    const data = { albumId: 3, hechos: 4, total: 11, pasos: [] };
    m.turn.mockImplementation(async (i: BotTurnInput) => {
      i.onToolResult!("ver_album", { ok: true, message: "x", data: { secreto: 1 } });
      i.onToolResult!("ver_progreso_escolar", { ok: false, message: "No encontrado" });
      i.onToolResult!("ver_progreso_escolar", { ok: true, message: "ok", data });
      return okTurn(i);
    });
    const body = await read(await POST(req("¿cómo voy?")));
    expect(body.match(/event: progreso/g)).toHaveLength(1);
    expect(body).toContain(`event: progreso\ndata: ${JSON.stringify(data)}\n\n`);
    expect(body).not.toContain("secreto");
  });
  it("el aviso de tope corre con after(): la respuesta termina aunque el aviso tarde", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    m.turn.mockImplementation(okTurn);
    m.cap.mockReturnValue(new Promise(() => {})); // Telegram/base colgados
    const body = await read(await POST(req("hola")));
    expect(body).toContain("event: done");
    expect(m.cap).not.toHaveBeenCalled();
    expect(m.after).toHaveLength(1);
    void m.after[0]!();
    await vi.waitFor(() => expect(m.cap).toHaveBeenCalledTimes(1));
  });
  it("si no se registró uso (tope ya alcanzado) no revisa el tope", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 5 });
    await read(await POST(req("hola")));
    await runAfter();
    expect(m.cap).not.toHaveBeenCalled();
  });
  it("BotTurnError → el incidente lleva userId y conversationId y el uso parcial cuenta el mensaje", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    const partial = { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    m.turn.mockRejectedValue(new BotTurnError(new Error("boom"), partial));
    const body = await read(await POST(req("hola")));
    expect(m.inc).toHaveBeenCalledWith({ area: "otro", codigo: "api_Error", ids: { userId: 7, conversationId: "c1" }, detalle: "boom", urgente: false });
    expect(m.usage).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, conversationId: "c1", usage: partial, countMessage: true }));
    expect(body).toContain("event: error");
    expect(body).not.toContain("event: done");
  });
  it("turno cortado por max_tokens → manda error y después done, con incidente turno_max_tokens", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    m.turn.mockResolvedValue({ appended: [{ role: "user", content: "hola" }], usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, outcome: "max_tokens" });
    const body = await read(await POST(req("hola")));
    expect(m.inc).toHaveBeenCalledWith({ area: "otro", codigo: "turno_max_tokens", ids: { conversationId: "c1" }, detalle: "max_tokens", urgente: false });
    const iErr = body.indexOf("event: error");
    const iDone = body.indexOf("event: done");
    expect(iErr).toBeGreaterThanOrEqual(0);
    expect(iDone).toBeGreaterThan(iErr);
    expect(body).toContain("Tuve un problema para responder. Probá de nuevo en un rato o tocá «Hablar con una persona».");
    expect(body).toContain('"conversationId":"c1"');
    await runAfter();
    expect(m.cap).toHaveBeenCalledTimes(1);
  });
  it("respuesta SSE con los headers de siempre", async () => {
    m.snap.mockResolvedValue({ userMessagesToday: 0, monthMicroUsd: 0 });
    m.turn.mockImplementation(okTurn);
    const res = await POST(req("hola"));
    expect(res.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    await read(res);
  });
});
