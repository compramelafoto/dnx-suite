import { beforeEach, describe, expect, it, vi } from "vitest";
import { BotTurnError } from "@repo/dnx-bot";

const m = vi.hoisted(() => ({ turn: vi.fn(), append: vi.fn(), inc: vi.fn(), after: [] as (() => Promise<void>)[] }));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => m.after.push(fn) }));
vi.mock("./anthropic", () => ({ clienteAnthropic: () => ({}) }));
vi.mock("./incidentes", () => ({ reportarIncidente: (...a: unknown[]) => m.inc(...a) }));
vi.mock("./store", () => ({ agregarMensajes: (...a: unknown[]) => m.append(...a) }));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), runBotTurn: (...a: unknown[]) => m.turn(...a) }));
import { FALLA_TURNO, respuestaDeTurno, type TurnoParams } from "./turno-sse";

const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
function base(over: Partial<TurnoParams> = {}): TurnoParams {
  return {
    model: "claude-sonnet-5-5",
    effort: "medium",
    maxIterations: 5,
    deadlineMs: Date.now() + 60_000,
    text: "hola",
    plataforma: "FOTOFFICE:ws1",
    verificarLimites: async () => null,
    preparar: async () => ({ conversationId: "c1", history: [], systemGuide: "G", situation: "S", tools: [], actor: { userId: 7, role: "WORKSPACE_OWNER", email: "", name: null } }),
    registrarUso: vi.fn(async () => {}),
    proponer: vi.fn(async () => ({ actionId: "a1" })),
    idsDeIncidente: (c) => ({ conversationId: c }),
    despuesDelTurno: vi.fn(async () => {}),
    ...over,
  };
}
beforeEach(() => {
  m.turn.mockReset();
  m.append.mockReset();
  m.inc.mockReset().mockResolvedValue(undefined);
  m.after.splice(0);
});

describe("respuestaDeTurno", () => {
  it("con corte de límites manda error sin ticket y no llama a la API", async () => {
    const body = await respuestaDeTurno(base({ verificarLimites: async () => "Cortado" })).text();
    expect(body).toContain("event: error");
    expect(body).toContain('"message":"Cortado"');
    expect(body).toContain('"offerTicket":false');
    expect(m.turn).not.toHaveBeenCalled();
  });

  it("turno ok: guarda, registra uso, manda done y corre despuesDelTurno después", async () => {
    m.turn.mockImplementation(async (i: { onText: (d: string) => void }) => {
      i.onText("Hola");
      return { appended: [{ role: "user", content: "hola" }], usage, outcome: "ok" };
    });
    const p = base();
    const res = respuestaDeTurno(p);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const body = await res.text();
    expect(body).toContain("event: text");
    expect(body).toContain("event: done");
    expect(m.append).toHaveBeenCalledWith("c1", [{ role: "user", content: "hola" }]);
    expect(p.registrarUso).toHaveBeenCalledWith("c1", usage, expect.any(Number));
    expect(p.despuesDelTurno).not.toHaveBeenCalled();
    for (const fn of m.after.splice(0)) await fn();
    expect(p.despuesDelTurno).toHaveBeenCalled();
  });

  it("una propuesta de escritura llega como evento proposal con la acción guardada", async () => {
    m.turn.mockImplementation(async (i: { proposeWrite: (w: unknown) => Promise<{ actionId: string }>; onProposal: (p: unknown) => void }) => {
      const { actionId } = await i.proposeWrite({ toolName: "t", input: {}, summary: "Hacer algo" });
      i.onProposal({ actionId, summary: "Hacer algo" });
      return { appended: [], usage, outcome: "ok" };
    });
    const p = base();
    const body = await respuestaDeTurno(p).text();
    expect(p.proponer).toHaveBeenCalledWith("c1", { toolName: "t", input: {}, summary: "Hacer algo" });
    expect(body).toContain("event: proposal");
  });

  it("falla de la API: cobra el uso parcial, reporta con la plataforma y no guarda mensajes", async () => {
    m.turn.mockRejectedValue(new BotTurnError(new Error("overloaded"), usage));
    const p = base();
    const body = await respuestaDeTurno(p).text();
    expect(p.registrarUso).toHaveBeenCalledWith("c1", usage, expect.any(Number));
    expect(m.append).not.toHaveBeenCalled();
    expect(m.inc.mock.calls[0]![0]).toMatchObject({ plataforma: "FOTOFFICE:ws1", codigo: "api_Error" });
    expect(body).toContain(FALLA_TURNO);
    expect(body).not.toContain('"offerTicket":true');
    for (const fn of m.after.splice(0)) await fn();
    expect(p.despuesDelTurno).toHaveBeenCalled();
  });

  it("turno cortado (iteration_cap): guarda lo hecho, avisa y reporta", async () => {
    m.turn.mockResolvedValue({ appended: [{ role: "user", content: "hola" }], usage, outcome: "iteration_cap" });
    const body = await respuestaDeTurno(base()).text();
    expect(m.append).toHaveBeenCalled();
    expect(m.inc.mock.calls[0]![0]).toMatchObject({ codigo: "turno_iteration_cap" });
    expect(body).toContain(FALLA_TURNO);
  });

  it("si falla preparar, error genérico y no corre despuesDelTurno", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = base({ preparar: async () => { throw new Error("db"); } });
    const body = await respuestaDeTurno(p).text();
    expect(body).toContain(FALLA_TURNO);
    for (const fn of m.after.splice(0)) await fn();
    expect(p.despuesDelTurno).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("revisarRespuesta: recibe el texto y lo nuevo del turno; su aviso sale como texto antes de done", async () => {
    m.turn.mockImplementation(async (i: { onText: (d: string) => void }) => {
      i.onText("Cobrá ");
      i.onText("$999.999");
      return { appended: [{ role: "user", content: "hola" }], usage, outcome: "ok" };
    });
    const revisar = vi.fn(async () => "Ojo: revisá");
    const body = await respuestaDeTurno(base({ revisarRespuesta: revisar })).text();
    expect(revisar).toHaveBeenCalledWith({ texto: "Cobrá $999.999", appended: [{ role: "user", content: "hola" }], history: [], conversationId: "c1" });
    expect(body.indexOf("Ojo: revisá")).toBeGreaterThan(-1);
    expect(body.indexOf("Ojo: revisá")).toBeLessThan(body.indexOf("event: done"));
  });

  it("con ventana: al modelo va lo recortado, pero las cifras se verifican contra el historial completo", async () => {
    m.turn.mockResolvedValue({ appended: [], usage, outcome: "ok" });
    const revisar = vi.fn(async () => null);
    const completo = [{ role: "user", content: "gasto 80000 cada 3 meses" }, { role: "assistant", content: "ok" }, { role: "user", content: "seguimos" }];
    const recortado = completo.slice(2);
    await respuestaDeTurno(
      base({
        revisarRespuesta: revisar,
        preparar: async () => ({
          conversationId: "c1", history: recortado, historialCompleto: completo, systemGuide: "G", situation: "S", tools: [],
          actor: { userId: 7, role: "WORKSPACE_OWNER", email: "", name: null },
        }),
      }),
    ).text();
    expect((m.turn.mock.calls[0]![0] as { history: unknown[] }).history).toEqual(recortado);
    expect((revisar.mock.calls[0] as unknown as [{ history: unknown[] }])[0].history).toEqual(completo);
  });

  it("si revisarRespuesta falla, el turno termina igual", async () => {
    m.turn.mockResolvedValue({ appended: [], usage, outcome: "ok" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await respuestaDeTurno(base({ revisarRespuesta: async () => { throw new Error("x"); } })).text();
    expect(body).toContain("event: done");
    log.mockRestore();
  });

  it("FALLA_TURNO no ofrece hablar con una persona", () => {
    expect(FALLA_TURNO).not.toMatch(/persona/i);
  });
});
