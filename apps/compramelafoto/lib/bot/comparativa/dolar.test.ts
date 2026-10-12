import { describe, expect, it, vi } from "vitest";
import { cotizacionDolar, DOLAR_TARJETA_URL } from "./dolar";

const ok = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

describe("cotizacionDolar", () => {
  it("usa la venta de dolarapi con 3 s de tope", async () => {
    const f = ok({ compra: 1400, venta: 1495.5 });
    expect(await cotizacionDolar({ fetchImpl: f, env: { CLF_BOT_USD_ARS: "1000" } })).toEqual({ pesosPorDolar: 1495.5, fuente: "dolarapi" });
    expect(f.mock.calls[0]![0]).toBe(DOLAR_TARJETA_URL);
    expect(f.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
  });
  it("si dolarapi falla, usa CLF_BOT_USD_ARS", async () => {
    const f = vi.fn().mockRejectedValue(new Error("caída"));
    expect(await cotizacionDolar({ fetchImpl: f, env: { CLF_BOT_USD_ARS: "1450" } })).toEqual({ pesosPorDolar: 1450, fuente: "variable" });
  });
  it("si dolarapi responde error o sin venta válida, usa la variable", async () => {
    const f500 = vi.fn().mockResolvedValue(new Response("x", { status: 500 }));
    expect((await cotizacionDolar({ fetchImpl: f500, env: { CLF_BOT_USD_ARS: "1450" } }))?.fuente).toBe("variable");
    expect((await cotizacionDolar({ fetchImpl: ok({ venta: 0 }), env: { CLF_BOT_USD_ARS: "1450" } }))?.fuente).toBe("variable");
  });
  it("respeta el timeout: un fetch que no contesta cae a la variable", async () => {
    const colgado = vi.fn((_u: unknown, init: { signal: AbortSignal }) =>
      new Promise<Response>((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("abort")))));
    const r = await cotizacionDolar({ fetchImpl: colgado as unknown as typeof fetch, env: { CLF_BOT_USD_ARS: "1450" }, timeoutMs: 20 });
    expect(r).toEqual({ pesosPorDolar: 1450, fuente: "variable" });
  });
  it("sin dolarapi ni variable (o variable inválida) devuelve null", async () => {
    const f = vi.fn().mockRejectedValue(new Error("caída"));
    expect(await cotizacionDolar({ fetchImpl: f, env: {} })).toBeNull();
    expect(await cotizacionDolar({ fetchImpl: f, env: { CLF_BOT_USD_ARS: "abc" } })).toBeNull();
  });
});
