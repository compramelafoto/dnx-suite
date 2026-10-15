import { describe, expect, it } from "vitest";
import {
  HARD_CAP_TURNS,
  carryOverMessage,
  countTurns,
  isTurnStart,
  summarizeDropped,
  windowHistory,
} from "./history";

type M = { role: "user" | "assistant"; content: unknown };

/** Un turno simple: lo que escribió la persona y la respuesta del bot. */
const turno = (n: number): M[] => [
  { role: "user", content: `mensaje ${n}` },
  { role: "assistant", content: [{ type: "text", text: `respuesta ${n}` }] },
];

/** Un turno con herramienta: user → assistant(tool_use) → user(tool_result) → assistant(texto). */
const turnoConHerramienta = (n: number): M[] => [
  { role: "user", content: `pregunta ${n}` },
  { role: "assistant", content: [{ type: "tool_use", id: `tu${n}`, name: "ver_perfil_de_precios", input: {} }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: `tu${n}`, content: "{}" }] },
  { role: "assistant", content: [{ type: "text", text: `listo ${n}` }] },
];

const historial = (n: number, f = turno) => Array.from({ length: n }, (_, i) => f(i + 1)).flat();

/** Cada tool_use del recorte tiene su tool_result justo después, y ningún tool_result queda huérfano. */
function parejasCompletas(msgs: unknown[]): boolean {
  const ms = msgs as M[];
  for (let i = 0; i < ms.length; i++) {
    const bloques = Array.isArray(ms[i]!.content) ? (ms[i]!.content as { type: string; id?: string; tool_use_id?: string }[]) : [];
    for (const b of bloques) {
      if (b.type === "tool_use") {
        const sig = ms[i + 1];
        const ok = sig && Array.isArray(sig.content) && (sig.content as { tool_use_id?: string }[]).some((x) => x.tool_use_id === b.id);
        if (!ok) return false;
      }
      if (b.type === "tool_result") {
        const prev = ms[i - 1];
        const ok = prev && Array.isArray(prev.content) && (prev.content as { id?: string }[]).some((x) => x.id === b.tool_use_id);
        if (!ok) return false;
      }
    }
  }
  return true;
}

describe("isTurnStart / countTurns", () => {
  it("un turno empieza en un mensaje de la persona (texto), nunca en un tool_result", () => {
    expect(isTurnStart({ role: "user", content: "hola" })).toBe(true);
    expect(isTurnStart({ role: "user", content: [{ type: "text", text: "hola" }] })).toBe(true);
    expect(isTurnStart({ role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "{}" }] })).toBe(false);
    expect(isTurnStart({ role: "assistant", content: "hola" })).toBe(false);
    expect(isTurnStart(null)).toBe(false);
  });
  it("cuenta turnos, no filas: la conversación real del 13/10 tenía 42 filas y 20 turnos", () => {
    expect(countTurns(historial(20, turnoConHerramienta))).toBe(20);
    expect(historial(20, turnoConHerramienta)).toHaveLength(80);
  });
});

describe("windowHistory", () => {
  it("una conversación corta va entera y sin resumen", () => {
    const h = historial(12);
    const v = windowHistory(h);
    expect(v.messages).toEqual(h);
    expect(v.start).toBe(0);
    expect(v.droppedTurns).toBe(0);
    expect(v.summary).toBeNull();
  });

  it("vacía: nada que recortar", () => {
    expect(windowHistory([])).toMatchObject({ messages: [], start: 0, droppedTurns: 0, totalTurns: 0, summary: null });
  });

  it("pasado el máximo, se descartan los turnos más viejos de a bloques (el prefijo queda fijo para el caché)", () => {
    const opts = { maxTurns: 10, step: 5 };
    const a = windowHistory(historial(11), opts);
    expect(a.droppedTurns).toBe(5);
    expect((a.messages[0] as M).content).toBe("mensaje 6");
    // Dos turnos más: mismo corte → mismo prefijo → el caché del historial sigue sirviendo.
    const b = windowHistory(historial(15), opts);
    expect(b.droppedTurns).toBe(5);
    expect(b.messages.slice(0, a.messages.length)).toEqual(a.messages);
    // Recién al pasar otra vez el máximo se corre el bloque siguiente.
    expect(windowHistory(historial(16), opts).droppedTurns).toBe(10);
  });

  it("nunca separa un tool_use de su tool_result y siempre arranca con un mensaje de la persona", () => {
    for (let n = 1; n <= 30; n++) {
      const v = windowHistory(historial(n, turnoConHerramienta), { maxTurns: 7, step: 3 });
      expect(parejasCompletas(v.messages), `n=${n}`).toBe(true);
      if (v.messages.length) expect(isTurnStart(v.messages[0]), `n=${n}`).toBe(true);
    }
  });

  it("con un historial muy pesado recorta por tamaño, pero deja siempre los últimos turnos", () => {
    const pesado = (n: number): M[] => [
      { role: "user", content: `pedido ${n}` },
      { role: "assistant", content: [{ type: "text", text: "x".repeat(5_000) }] },
    ];
    const v = windowHistory(historial(12, pesado), { maxTurns: 40, step: 4, maxChars: 20_000, minTurns: 2 });
    expect(JSON.stringify(v.messages).length).toBeLessThanOrEqual(20_000);
    expect(v.totalTurns - v.droppedTurns).toBeGreaterThanOrEqual(2);
    expect((v.messages.at(-2) as M).content).toBe("pedido 12");
    const minimo = windowHistory(historial(12, pesado), { maxTurns: 40, step: 4, maxChars: 10, minTurns: 2 });
    expect(minimo.totalTurns - minimo.droppedTurns).toBe(2);
  });

  it("el resumen cuenta lo descartado: lo que escribió la persona y las herramientas usadas", () => {
    const v = windowHistory(historial(12, turnoConHerramienta), { maxTurns: 6, step: 6 });
    expect(v.droppedTurns).toBe(6);
    expect(v.summary).toContain("pregunta 1");
    expect(v.summary).toContain("pregunta 6");
    expect(v.summary).not.toContain("pregunta 7");
    expect(v.summary).toContain("ver_perfil_de_precios");
    expect(v.summary).toMatch(/no (la )?empez/i);
  });
});

describe("summarizeDropped", () => {
  it("sin nada descartado: null", () => {
    expect(summarizeDropped([])).toBeNull();
  });
  it("recorta textos largos y se queda con los últimos", () => {
    const h = historial(30).map((m) => (m.role === "user" ? { ...m, content: `${m.content} ${"palabra ".repeat(100)}` } : m));
    const s = summarizeDropped(h, { maxTexts: 5, maxCharsPerText: 50 })!;
    expect(s).toContain("mensaje 30");
    expect(s).not.toContain("mensaje 25 ");
    expect(s).toMatch(/25 más viejos/);
    expect(s.length).toBeLessThan(1_000);
  });
  it("es determinístico (mismo historial, mismo texto: no rompe el caché)", () => {
    const h = historial(9, turnoConHerramienta);
    expect(summarizeDropped(h)).toBe(summarizeDropped(structuredClone(h)));
  });
});

describe("tope duro y arrastre", () => {
  it("el tope duro es grande y en turnos", () => {
    expect(HARD_CAP_TURNS).toBeGreaterThanOrEqual(100);
  });
  it("carryOverMessage: un mensaje [Sistema] con el resumen de la conversación anterior", () => {
    const m = carryOverMessage(historial(5));
    expect(m.role).toBe("user");
    expect(m.content).toMatch(/^\[Sistema\]/);
    expect(m.content).toContain("mensaje 5");
    expect(isTurnStart(m)).toBe(true);
  });
});
