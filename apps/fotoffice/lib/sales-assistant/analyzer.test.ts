import { describe, expect, it } from "vitest";
import { analizarOportunidad, type LlamadaClaude } from "./analyzer";

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
