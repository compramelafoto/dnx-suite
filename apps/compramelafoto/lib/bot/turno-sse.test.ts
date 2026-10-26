import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ turn: vi.fn(), append: vi.fn(), inc: vi.fn(), after: [] as (() => Promise<void>)[] }));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => m.after.push(fn) }));
vi.mock("@/lib/bot/anthropic", () => ({ getAnthropicClient: () => ({}) }));
vi.mock("@/lib/bot/escalamiento", () => ({ reportIncident: (...a: unknown[]) => m.inc(...a) }));
vi.mock("@/lib/bot/store", () => ({ appendMessages: (...a: unknown[]) => m.append(...a) }));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), runBotTurn: (...a: unknown[]) => m.turn(...a) }));
import { respuestaDeTurnoSse, type TurnoSseParams } from "./turno-sse";

const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
function base(over: Partial<TurnoSseParams> = {}): TurnoSseParams {
  return {
    model: "claude-sonnet-5-5", effort: "low", maxIterations: 5, deadlineMs: Date.now() + 60_000, text: "hola",
    verificarLimites: async () => null,
    preparar: async () => ({ conversationId: "c1", history: [], systemGuide: "G", situation: "S", tools: [], actor: { userId: 0, role: "BUYER", email: "", name: null } }),
    registrarUso: vi.fn(async () => {}),
    proponer: vi.fn(async () => ({ actionId: "a1" })),
    idsDeIncidente: (c) => ({ conversationId: c }),
    despuesDelTurno: vi.fn(async () => {}),
    ...over,
  };
}
beforeEach(() => { m.turn.mockReset(); m.append.mockReset(); m.inc.mockReset().mockResolvedValue(undefined); m.after.splice(0); });

describe("respuestaDeTurnoSse", () => {
  it("alGuardar recibe lo agregado después de guardarlo; si falla, el turno igual termina bien", async () => {
    const appended = [{ role: "user", content: "hola" }, { role: "assistant", content: [{ type: "text", text: "¡Hola!" }] }];
    m.turn.mockResolvedValue({ appended, usage, outcome: "ok" });
    const guardar = vi.fn(async () => {});
    await respuestaDeTurnoSse(base({ alGuardar: guardar })).text();
    expect(guardar).toHaveBeenCalledWith("c1", appended);
    expect(m.append.mock.invocationCallOrder[0]).toBeLessThan(guardar.mock.invocationCallOrder[0]!);

    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await respuestaDeTurnoSse(base({ alGuardar: async () => { throw new Error("db"); } })).text();
    expect(body).toContain("event: done");
    log.mockRestore();
  });
  it("con corte de límites manda error y no llama a la API", async () => {
    const body = await respuestaDeTurnoSse(base({ verificarLimites: async () => "Cortado" })).text();
    expect(body).toContain("event: error");
    expect(body).toContain("Cortado");
    expect(m.turn).not.toHaveBeenCalled();
  });
  it("turno ok: guarda, registra uso, manda done y corre despuesDelTurno", async () => {
    m.turn.mockImplementation(async (i: { onText: (d: string) => void }) => { i.onText("Hola"); return { appended: [{ role: "user", content: "hola" }], usage, outcome: "ok" }; });
    const p = base();
    const body = await respuestaDeTurnoSse(p).text();
    expect(body).toContain("event: text");
    expect(body).toContain("event: done");
    expect(m.append).toHaveBeenCalledWith("c1", [{ role: "user", content: "hola" }]);
    expect(p.registrarUso).toHaveBeenCalledWith("c1", usage, expect.any(Number));
    for (const fn of m.after.splice(0)) await fn();
    expect(p.despuesDelTurno).toHaveBeenCalled();
  });
  it("alTerminar corre una vez al final, también con corte o con falla, y su error no rompe la respuesta", async () => {
    const corte = vi.fn(async () => {});
    await respuestaDeTurnoSse(base({ verificarLimites: async () => "Cortado", alTerminar: corte })).text();
    expect(corte).toHaveBeenCalledTimes(1);

    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const falla = vi.fn(async () => { throw new Error("db"); });
    const body = await respuestaDeTurnoSse(base({ preparar: async () => { throw new Error("x"); }, alTerminar: falla })).text();
    expect(falla).toHaveBeenCalledTimes(1);
    expect(body).toContain("event: error");
    log.mockRestore();

    m.turn.mockResolvedValue({ appended: [], usage, outcome: "ok" });
    const ok = vi.fn(async () => {});
    const p = base({ alTerminar: ok });
    await respuestaDeTurnoSse(p).text();
    expect(ok).toHaveBeenCalledTimes(1);
    expect((p.registrarUso as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!).toBeLessThan(ok.mock.invocationCallOrder[0]!);
  });
  it("agrega los headers pedidos (cookie del invitado)", () => {
    const res = respuestaDeTurnoSse(base({ headers: { "set-cookie": "dnxbot_guest=x" } }));
    expect(res.headers.get("set-cookie")).toBe("dnxbot_guest=x");
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });
});
