import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BotTurnError, runBotTurn } from "./engine";
import { defineTool } from "./types";

function fakeClient(responses: any[]) {
  const calls: any[] = [];
  return {
    calls,
    beta: {
      messages: {
        stream: (params: any) => {
          calls.push(structuredClone(params));
          const msg = responses.shift();
          return {
            on: (_e: "text", cb: (d: string) => void) => {
              for (const b of msg.content) if (b.type === "text") cb(b.text);
            },
            finalMessage: async () => msg,
          };
        },
      },
    },
  };
}
const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 };
const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" };

const leer = defineTool({
  name: "ver_album", description: "d", kind: "read",
  input: z.strictObject({ albumId: z.number().int() }),
  run: async ({ albumId }) => ({ ok: true, message: `álbum ${albumId}` }),
});
const escribir = defineTool({
  name: "actualizar_album", description: "d", kind: "write",
  input: z.strictObject({ albumId: z.number().int() }),
  describe: async ({ albumId }) => `Publicar el álbum ${albumId}`,
  run: vi.fn(async () => ({ ok: true, message: "hecho" })),
});

const base = {
  model: "claude-sonnet-5-5", effort: "medium" as const, systemGuide: "GUIA", situation: "SIT",
  actor, history: [], maxIterations: 4,
};

describe("runBotTurn", () => {
  it("corre herramientas de lectura y devuelve el texto final", async () => {
    const client = fakeClient([
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "ver_album", input: { albumId: 3 } }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Listo" }] },
    ]);
    const texts: string[] = [];
    const r = await runBotTurn({
      ...base, client, tools: [leer], userText: "hola",
      onText: (d) => texts.push(d), proposeWrite: vi.fn(), onProposal: vi.fn(),
    });
    expect(texts.join("")).toBe("Listo");
    expect(r.outcome).toBe("ok");
    expect(r.appended.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    const toolResult = (r.appended[2]!.content as any[])[0];
    expect(toolResult).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
    expect(r.usage.input_tokens).toBe(20);
  });

  it("separa con un párrafo el texto de vueltas distintas", async () => {
    const client = fakeClient([
      { stop_reason: "tool_use", usage, content: [{ type: "text", text: "Miro." }, { type: "tool_use", id: "t1", name: "ver_album", input: { albumId: 3 } }] },
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t2", name: "ver_album", input: { albumId: 4 } }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Tu cuenta" }, { type: "text", text: " está bien." }] },
    ]);
    const texts: string[] = [];
    await runBotTurn({ ...base, client, tools: [leer], userText: "hola", onText: (d) => texts.push(d), proposeWrite: vi.fn(), onProposal: vi.fn() });
    expect(texts.join("")).toBe("Miro.\n\nTu cuenta está bien.");
  });

  it("una herramienta de escritura NO corre: se propone", async () => {
    const client = fakeClient([
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "actualizar_album", input: { albumId: 3 } }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Confirmá abajo" }] },
    ]);
    const proposeWrite = vi.fn(async () => ({ actionId: "a1" }));
    const onProposal = vi.fn();
    const r = await runBotTurn({ ...base, client, tools: [escribir], userText: "publicalo", onText: () => {}, proposeWrite, onProposal });
    expect(escribir.run).not.toHaveBeenCalled();
    expect(proposeWrite).toHaveBeenCalledWith({ toolName: "actualizar_album", input: { albumId: 3 }, summary: "Publicar el álbum 3" });
    expect(onProposal).toHaveBeenCalledWith({ actionId: "a1", summary: "Publicar el álbum 3" });
    expect(JSON.stringify(r.appended[2]!.content)).toContain("PENDIENTE_DE_CONFIRMACION");
  });

  it("prepare: la entrada que se describe y se guarda en la propuesta es la preparada (congelada al proponer)", async () => {
    const conPrepare = defineTool({
      name: "guardar_algo",
      description: "d",
      input: z.object({ a: z.string(), b: z.string().optional() }),
      kind: "write",
      prepare: async (i) => ({ ...i, b: "del borrador" }),
      describe: async (i) => `Guardar ${i.a} y ${i.b}`,
      run: vi.fn(),
    });
    const client = fakeClient([
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "guardar_algo", input: { a: "x" } }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "Confirmá abajo" }] },
    ]);
    const proposeWrite = vi.fn(async () => ({ actionId: "a1" }));
    await runBotTurn({ ...base, client, tools: [conPrepare], userText: "guardalo", onText: () => {}, proposeWrite, onProposal: vi.fn() });
    expect(proposeWrite).toHaveBeenCalledWith({ toolName: "guardar_algo", input: { a: "x", b: "del borrador" }, summary: "Guardar x y del borrador" });
  });

  it("entrada inválida → tool_result con is_error, sin correr", async () => {
    const client = fakeClient([
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "ver_album", input: { albumId: "x" } }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] },
    ]);
    const r = await runBotTurn({ ...base, client, tools: [leer], userText: "x", onText: () => {}, proposeWrite: vi.fn(), onProposal: vi.fn() });
    expect((r.appended[2]!.content as any[])[0].is_error).toBe(true);
  });

  it("herramienta desconocida → is_error", async () => {
    const client = fakeClient([
      { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "borrar_album", input: {} }] },
      { stop_reason: "end_turn", usage, content: [{ type: "text", text: "no puedo" }] },
    ]);
    const r = await runBotTurn({ ...base, client, tools: [leer], userText: "x", onText: () => {}, proposeWrite: vi.fn(), onProposal: vi.fn() });
    expect((r.appended[2]!.content as any[])[0]).toMatchObject({ is_error: true });
  });

  it("refusal corta y no corre herramientas", async () => {
    const client = fakeClient([{ stop_reason: "refusal", usage, content: [] }]);
    const r = await runBotTurn({ ...base, client, tools: [leer], userText: "x", onText: () => {}, proposeWrite: vi.fn(), onProposal: vi.fn() });
    expect(r.outcome).toBe("refusal");
  });

  it("max_tokens con tool_use cortado no deja tool_use sin respuesta en el historial", async () => {
    const client = fakeClient([{ stop_reason: "max_tokens", usage, content: [{ type: "tool_use", id: "t1", name: "ver_album", input: {} }] }]);
    const r = await runBotTurn({ ...base, client, tools: [leer], userText: "x", onText: () => {}, proposeWrite: vi.fn(), onProposal: vi.fn() });
    expect(r.outcome).toBe("max_tokens");
    expect(r.appended).toEqual([{ role: "user", content: "x" }]);
  });

  it("tope de iteraciones", async () => {
    const loop = { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t", name: "ver_album", input: { albumId: 1 } }] };
    const client = fakeClient([loop, loop, loop, loop, loop]);
    const r = await runBotTurn({ ...base, maxIterations: 2, client, tools: [leer], userText: "x", onText: () => {}, proposeWrite: vi.fn(), onProposal: vi.fn() });
    expect(r.outcome).toBe("iteration_cap");
    expect(client.calls).toHaveLength(2);
  });

  it("envía la guía con caché, la situación aparte, y el historial sin modificar", async () => {
    const history = [{ role: "user", content: "antes" }, { role: "assistant", content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "r" }] }];
    const client = fakeClient([{ stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] }]);
    await runBotTurn({ ...base, history, client, tools: [leer], userText: "x", onText: () => {}, proposeWrite: vi.fn(), onProposal: vi.fn() });
    const p = client.calls[0];
    expect(p.system[0]).toMatchObject({ text: "GUIA", cache_control: { type: "ephemeral" } });
    expect(p.system[1]).toMatchObject({ text: "SIT" });
    expect(p.messages.slice(0, 2)).toEqual(history);
    expect(p.thinking).toEqual({ type: "adaptive" });
    expect(p).not.toHaveProperty("tool_choice");
  });

  const noop = { onText: () => {}, onProposal: vi.fn() };
  const endTurn = { stop_reason: "end_turn", usage, content: [{ type: "text", text: "ok" }] };
  const useWrite = { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "actualizar_album", input: { albumId: 3 } }] };

  it("describe que falla → is_error, no corre, el turno sigue", async () => {
    const rota = defineTool({ name: "actualizar_album", description: "d", kind: "write", input: z.strictObject({ albumId: z.number().int() }),
      describe: async () => { throw new Error("boom"); }, run: vi.fn(async () => ({ ok: true as const, message: "x" })) });
    const client = fakeClient([useWrite, endTurn]);
    const proposeWrite = vi.fn();
    const r = await runBotTurn({ ...base, ...noop, client, tools: [rota], userText: "x", proposeWrite });
    expect(rota.run).not.toHaveBeenCalled();
    expect(proposeWrite).not.toHaveBeenCalled();
    expect((r.appended[2]!.content as any[])[0]).toMatchObject({ is_error: true });
    expect(JSON.stringify(r.appended[2]!.content)).toContain("No se pudo preparar la acción");
    expect(r.outcome).toBe("ok");
  });

  it("proposeWrite que falla → is_error y el turno sigue", async () => {
    const client = fakeClient([useWrite, endTurn]);
    const r = await runBotTurn({ ...base, ...noop, client, tools: [escribir], userText: "x", proposeWrite: async () => { throw new Error("db caída"); } });
    expect((r.appended[2]!.content as any[])[0]).toMatchObject({ is_error: true });
    expect(r.outcome).toBe("ok");
  });

  it("lectura que lanza → is_error Falló la consulta", async () => {
    const mala = defineTool({ name: "ver_album", description: "d", kind: "read", input: z.strictObject({ albumId: z.number().int() }),
      run: async () => { throw new Error("x"); } });
    const client = fakeClient([{ stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "ver_album", input: { albumId: 1 } }] }, endTurn]);
    const r = await runBotTurn({ ...base, ...noop, client, tools: [mala], userText: "x", proposeWrite: vi.fn() });
    const tr = (r.appended[2]!.content as any[])[0];
    expect(tr.is_error).toBe(true);
    expect(tr.content).toContain("Falló la consulta");
  });

  it("dos tool_use → un solo mensaje user con dos tool_result en orden", async () => {
    const client = fakeClient([{ stop_reason: "tool_use", usage, content: [
      { type: "tool_use", id: "a", name: "ver_album", input: { albumId: 1 } },
      { type: "tool_use", id: "b", name: "ver_album", input: { albumId: 2 } }] }, endTurn]);
    const r = await runBotTurn({ ...base, ...noop, client, tools: [leer], userText: "x", proposeWrite: vi.fn() });
    expect(r.appended.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect((r.appended[2]!.content as any[]).map((c) => c.tool_use_id)).toEqual(["a", "b"]);
  });

  it("max_tokens con contenido vacío → sólo el mensaje del usuario", async () => {
    const client = fakeClient([{ stop_reason: "max_tokens", usage, content: [] }]);
    const r = await runBotTurn({ ...base, ...noop, client, tools: [leer], userText: "x", proposeWrite: vi.fn() });
    expect(r.outcome).toBe("max_tokens");
    expect(r.appended).toEqual([{ role: "user", content: "x" }]);
  });

  it("pide caché automático a nivel de solicitud sin tocar el historial guardado", async () => {
    const history = [{ role: "user", content: "antes" }, { role: "assistant", content: [{ type: "text", text: "r" }] }];
    const snapshot = structuredClone(history);
    const client = fakeClient([endTurn]);
    await runBotTurn({ ...base, ...noop, history, client, tools: [leer], userText: "x", proposeWrite: vi.fn() });
    expect(client.calls[0].cache_control).toEqual({ type: "ephemeral" });
    expect(client.calls[0].messages.slice(0, 2)).toEqual(snapshot);
    expect(history).toEqual(snapshot);
  });

  it("plazo vencido antes de empezar → iteration_cap sin llamar a la API", async () => {
    const client = fakeClient([endTurn]);
    const r = await runBotTurn({ ...base, ...noop, deadlineMs: Date.now() - 1, client, tools: [leer], userText: "x", proposeWrite: vi.fn() });
    expect(r.outcome).toBe("iteration_cap");
    expect(client.calls).toHaveLength(0);
    expect(r.appended).toEqual([{ role: "user", content: "x" }]);
  });

  it("plazo vencido entre vueltas → corta tras los tool_results, historial válido", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(1_000).mockReturnValue(10_000);
    try {
      const loop = { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t", name: "ver_album", input: { albumId: 1 } }] };
      const client = fakeClient([loop, endTurn]);
      const r = await runBotTurn({ ...base, ...noop, deadlineMs: 5_000, client, tools: [leer], userText: "x", proposeWrite: vi.fn() });
      expect(r.outcome).toBe("iteration_cap");
      expect(client.calls).toHaveLength(1);
      expect(r.appended.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
      expect((r.appended[2]!.content as any[])[0]).toMatchObject({ type: "tool_result", tool_use_id: "t" });
      expect(r.usage.input_tokens).toBe(10);
    } finally {
      now.mockRestore();
    }
  });

  it("si la API falla a mitad del turno, el error lleva el uso ya consumido", async () => {
    const calls: any[] = [];
    let n = 0;
    const client = {
      calls,
      beta: { messages: { stream: () => {
        n++;
        if (n === 1) return { on: () => {}, finalMessage: async () => ({ stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t", name: "ver_album", input: { albumId: 1 } }] }) };
        return { on: () => {}, finalMessage: async () => { throw new Error("overloaded"); } };
      } } },
    };
    const err = await runBotTurn({ ...base, ...noop, client, tools: [leer], userText: "x", proposeWrite: vi.fn() }).catch((e) => e);
    expect(err).toBeInstanceOf(BotTurnError);
    expect(err.message).toBe("overloaded");
    expect(err.usage).toEqual(usage);
    expect((err.cause as Error).message).toBe("overloaded");
  });

  it("onToolResult recibe cada lectura con su resultado, pero no las propuestas", async () => {
    const client = fakeClient([
      { stop_reason: "tool_use", usage, content: [
        { type: "tool_use", id: "t1", name: "ver_album", input: { albumId: 3 } },
        { type: "tool_use", id: "t2", name: "actualizar_album", input: { albumId: 3 } },
      ] },
      endTurn,
    ]);
    const onToolResult = vi.fn();
    await runBotTurn({ ...base, ...noop, client, tools: [leer, escribir], userText: "x", proposeWrite: async () => ({ actionId: "a1" }), onToolResult });
    expect(onToolResult).toHaveBeenCalledTimes(1);
    expect(onToolResult).toHaveBeenCalledWith("ver_album", { ok: true, message: "álbum 3" });
  });

  it("onToolResult que lanza no rompe el turno ni cambia el tool_result", async () => {
    const client = fakeClient([{ stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: "t1", name: "ver_album", input: { albumId: 3 } }] }, endTurn]);
    const r = await runBotTurn({ ...base, ...noop, client, tools: [leer], userText: "x", proposeWrite: vi.fn(), onToolResult: () => { throw new Error("boom"); } });
    expect(r.outcome).toBe("ok");
    const tr = (r.appended[2]!.content as any[])[0];
    expect(tr.is_error).toBeUndefined();
    expect(JSON.parse(tr.content)).toEqual({ ok: true, message: "álbum 3" });
  });
});
