import { beforeEach, describe, expect, it, vi } from "vitest";

// Base en memoria: la firma única se comporta como el índice (platform, signature).
const m = vi.hoisted(() => ({
  global: 0,
  ws: 0,
  marcas: new Set<string>(),
  tg: vi.fn(),
  telegram: { token: "t", chatId: "c" } as { token: string; chatId: string } | null,
}));
vi.mock("./store", () => ({
  gastoDelMes: async (p: { plataforma?: string }) => (p.plataforma ? m.ws : m.global),
  reservarMarca: async (p: { plataforma: string; signature: string }) => {
    const k = `${p.plataforma}|${p.signature}`;
    if (m.marcas.has(k)) return false;
    m.marcas.add(k);
    return true;
  },
  liberarMarca: async (p: { plataforma: string; signature: string }) => {
    m.marcas.delete(`${p.plataforma}|${p.signature}`);
  },
}));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), sendTelegramMessage: (...a: unknown[]) => m.tg(...a) }));
vi.mock("./config", async (orig) => ({
  ...(await orig<object>()),
  leerConfigBot: () => ({
    limits: { maxMessagesPerUserPerDay: 60, monthlyCapMicroUsd: 15_000_000, workspaceMonthlyCapMicroUsd: 10_000_000 },
    telegram: m.telegram,
  }),
}));
import { avisarTopes } from "./tope";

const OCT = new Date("2026-10-20T15:00:00Z");
const NOV = new Date("2026-11-02T15:00:00Z");
const textos = () => m.tg.mock.calls.map((c) => c[1] as string);

beforeEach(() => {
  m.global = 0;
  m.ws = 0;
  m.marcas.clear();
  m.telegram = { token: "t", chatId: "c" };
  m.tg.mockReset().mockResolvedValue({ ok: true });
});

describe("avisarTopes", () => {
  it("debajo del 80 % no avisa ni reserva", async () => {
    m.global = 11_999_999;
    m.ws = 7_999_999;
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    expect(m.tg).not.toHaveBeenCalled();
    expect(m.marcas.size).toBe(0);
  });

  it("80 % del tope global: un aviso en el mes, marcado en FOTOFFICE", async () => {
    m.global = 12_000_000;
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    expect(textos()).toEqual(["⚠️ FOTOFFICE · DNX Bot llegó al 80 % del tope mensual: USD 12,00 de USD 15."]);
    expect([...m.marcas]).toEqual(["FOTOFFICE|cap-80-2026-10"]);
  });

  it("100 % global avisa ese umbral sin repetir el 80", async () => {
    m.global = 12_000_000;
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    m.global = 15_000_000;
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    expect(textos()).toHaveLength(2);
    expect(textos()[1]).toBe("🛑 FOTOFFICE · DNX Bot llegó al tope mensual (USD 15): no responde hasta el 1/11. El resto de FOTOFFICE sigue igual.");
  });

  it("tope del workspace: avisos propios marcados en la plataforma del workspace", async () => {
    m.ws = 8_000_000;
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    expect(textos()).toEqual(["⚠️ FOTOFFICE · DNX Bot llegó al 80 % del tope mensual del workspace ws1: USD 8,00 de USD 10."]);
    expect([...m.marcas]).toEqual(["FOTOFFICE:ws1|cap-ws-80-2026-10"]);
    m.ws = 10_000_000;
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    expect(textos()[1]).toContain("tope mensual del workspace ws1 (USD 10)");
  });

  it("si Telegram falla, libera la marca y el turno siguiente reintenta", async () => {
    m.global = 12_000_000;
    m.tg.mockResolvedValueOnce({ ok: false, error: "timeout" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    expect(m.marcas.size).toBe(0);
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    expect(m.tg).toHaveBeenCalledTimes(2);
    expect(m.marcas.size).toBe(1);
    log.mockRestore();
  });

  it("mes nuevo vuelve a avisar", async () => {
    m.global = 12_000_000;
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    await avisarTopes({ workspaceId: "ws1", ahora: NOV });
    expect(m.tg).toHaveBeenCalledTimes(2);
  });

  it("sin Telegram no reserva nada (sale en cuanto se configure)", async () => {
    m.telegram = null;
    m.global = 15_000_000;
    await avisarTopes({ workspaceId: "ws1", ahora: OCT });
    expect(m.marcas.size).toBe(0);
  });

  it("nunca lanza", async () => {
    m.global = 15_000_000;
    m.tg.mockRejectedValue(new Error("red"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(avisarTopes({ workspaceId: "ws1", ahora: OCT })).resolves.toBeUndefined();
    log.mockRestore();
  });
});
