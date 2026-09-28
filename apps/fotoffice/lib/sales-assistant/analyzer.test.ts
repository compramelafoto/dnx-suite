import { afterEach, describe, expect, it } from "vitest";
import { analizarOportunidad, iaDisponible, modeloIA, type LlamadaClaude } from "./analyzer";

const ok: LlamadaClaude = async () => ({
  texto: JSON.stringify({ accion: "ESCRIBIR", prioridad: "ALTA", motivo: "Sin respuesta hace 6 días", mensaje: "Hola Sabri!", esperarDias: null }),
  stopReason: "end_turn", inputTokens: 1200, outputTokens: 90, modelo: "claude-opus-5",
});

describe("analizarOportunidad", () => {
  it("devuelve la sugerencia validada y los tokens", async () => {
    const r = await analizarOportunidad("ctx", ok);
    expect(r).toMatchObject({ fallo: false, inputTokens: 1200, outputTokens: 90, sugerencia: { accion: "ESCRIBIR", mensaje: "Hola Sabri!" } });
  });
  it("una respuesta inválida queda para revisar a mano", async () => {
    const r = await analizarOportunidad("ctx", async () => ({ texto: "{\"accion\":\"LLAMAR\"}", stopReason: "end_turn", inputTokens: 1, outputTokens: 1, modelo: "m" }));
    expect(r).toMatchObject({ fallo: true, sugerencia: { accion: "REVISAR_A_MANO", motivo: "No se pudo analizar", mensaje: null } });
  });
  it("un rechazo queda para revisar a mano", async () => {
    const r = await analizarOportunidad("ctx", async () => ({ texto: null, stopReason: "refusal", inputTokens: 1, outputTokens: 0, modelo: "m" }));
    expect(r.fallo).toBe(true);
  });
  it("un error de red no se propaga", async () => {
    const r = await analizarOportunidad("ctx", async () => { throw new Error("ECONNRESET"); });
    expect(r.fallo).toBe(true);
  });
  it("ESPERAR sin días usa 3", async () => {
    const r = await analizarOportunidad("ctx", async () => ({ texto: JSON.stringify({ accion: "ESPERAR", prioridad: "BAJA", motivo: "x", mensaje: null, esperarDias: null }), stopReason: "end_turn", inputTokens: 1, outputTokens: 1, modelo: "m" }));
    expect(r.sugerencia.esperarDias).toBe(3);
  });
});

describe("modeloIA", () => {
  const original = process.env.FOTOFFICE_SALES_AI_MODEL;
  afterEach(() => {
    if (original === undefined) delete process.env.FOTOFFICE_SALES_AI_MODEL;
    else process.env.FOTOFFICE_SALES_AI_MODEL = original;
  });

  it("usa claude-opus-5 por default", () => {
    delete process.env.FOTOFFICE_SALES_AI_MODEL;
    expect(modeloIA()).toBe("claude-opus-5");
  });
  it("respeta el override de FOTOFFICE_SALES_AI_MODEL", () => {
    process.env.FOTOFFICE_SALES_AI_MODEL = "claude-otro-modelo";
    expect(modeloIA()).toBe("claude-otro-modelo");
  });
  it("recorta espacios del override y usa el default si queda vacío", () => {
    process.env.FOTOFFICE_SALES_AI_MODEL = "  claude-otro-modelo  ";
    expect(modeloIA()).toBe("claude-otro-modelo");
    process.env.FOTOFFICE_SALES_AI_MODEL = "   ";
    expect(modeloIA()).toBe("claude-opus-5");
  });
});

describe("iaDisponible", () => {
  const original = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = original;
  });

  it("es true cuando hay ANTHROPIC_API_KEY", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-123";
    expect(iaDisponible()).toBe(true);
  });
  it("es false sin ANTHROPIC_API_KEY, o si sólo tiene espacios", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(iaDisponible()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "   ";
    expect(iaDisponible()).toBe(false);
  });
});
