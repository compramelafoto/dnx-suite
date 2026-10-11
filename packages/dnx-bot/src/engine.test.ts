import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runBotTurn } from "./engine";
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
});
