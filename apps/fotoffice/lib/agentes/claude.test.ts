import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { Anthropic } = await import("@repo/dnx-bot");
const { conversar } = await import("./claude");
import type { ClienteClaude } from "./claude";

/** Un cliente falso que siempre lanza el error dado. */
function clienteQueLanza(e: unknown): ClienteClaude {
  return { beta: { messages: { create: async () => Promise.reject(e) } } };
}

async function fallaCon(cliente: ClienteClaude | null, hasta = Date.now() + 60_000) {
  const r = await conversar({
    sistema: "s",
    pedido: "p",
    conBusqueda: false,
    parsear: () => ({ ok: true, valor: 1 }),
    hasta,
    deps: { cliente },
  });
  if (r.ok) throw new Error("debía fallar");
  return r.falla;
}

const errorApi = (status: number, mensaje = "x") => Anthropic.APIError.generate(status, { error: { message: mensaje } }, mensaje, new Headers());

describe("conversar: por qué falló", () => {
  it("sin clave es una falla del servicio", async () => {
    expect(await fallaCon(null)).toBe("SERVICIO");
  });

  it("401, 403, 429 y 529 son del servicio", async () => {
    for (const status of [401, 403, 429, 529]) expect(await fallaCon(clienteQueLanza(errorApi(status)))).toBe("SERVICIO");
  });

  it("sin conexión es del servicio; sin crédito (400) también", async () => {
    expect(await fallaCon(clienteQueLanza(new Anthropic.APIConnectionError({ message: "red" })))).toBe("SERVICIO");
    expect(await fallaCon(clienteQueLanza(errorApi(400, "Your credit balance is too low")))).toBe("SERVICIO");
  });

  it("un corte por tiempo a mitad de pedido es CORTADA", async () => {
    expect(await fallaCon(clienteQueLanza(new Anthropic.APIConnectionTimeoutError()))).toBe("CORTADA");
  });

  it("sin tiempo para empezar es SIN_TIEMPO; otro error es de la tarea", async () => {
    expect(await fallaCon(clienteQueLanza(errorApi(500)), Date.now() + 1_000)).toBe("SIN_TIEMPO");
    expect(await fallaCon(clienteQueLanza(errorApi(400, "bad request")))).toBe("TAREA");
  });
});
