import { beforeEach, describe, expect, it, vi } from "vitest";

// Base en memoria: la firma única se comporta como el índice (platform, signature) → P2002 al repetir.
const m = vi.hoisted(() => ({ spent: 0, signatures: new Set<string>(), tg: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    botUsageDaily: { aggregate: async () => ({ _sum: { costMicroUsd: m.spent } }) },
    botIncident: { create: (...a: unknown[]) => m.create(...a) },
  },
}));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), sendTelegramMessage: (...a: unknown[]) => m.tg(...a) }));
vi.mock("@/lib/bot/config", () => ({
  BOT_PLATFORM: "CLF",
  readBotConfig: () => ({ limits: { maxMessagesPerUserPerDay: 50, monthlyCapMicroUsd: 30_000_000 }, telegram: { token: "t", chatId: "c" } }),
}));
import { notifyCapThresholds } from "./tope";

const OCT = new Date("2026-10-20T15:00:00Z");
const NOV = new Date("2026-11-02T15:00:00Z");
const realCreate = async (a: { data: { signature: string } }) => {
  if (m.signatures.has(a.data.signature)) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
  m.signatures.add(a.data.signature);
  return { id: a.data.signature };
};

beforeEach(() => {
  m.spent = 0;
  m.signatures.clear();
  m.tg.mockReset().mockResolvedValue({ ok: true });
  m.create.mockReset().mockImplementation(realCreate);
});

describe("notifyCapThresholds", () => {
  it("por debajo del 80 % no avisa ni reserva nada", async () => {
    m.spent = 23_990_000;
    await notifyCapThresholds(OCT);
    expect(m.tg).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("al cruzar el 80 % avisa una sola vez en el mes", async () => {
    m.spent = 24_500_000;
    await notifyCapThresholds(OCT);
    await notifyCapThresholds(OCT);
    expect(m.tg).toHaveBeenCalledTimes(1);
    expect(m.tg.mock.calls[0]![1]).toBe("⚠️ DNX Bot llegó al 80 % del tope mensual: USD 24,50 de USD 30 (se factura en dólares).");
    expect(m.create.mock.calls[0]![0]).toMatchObject({ data: { platform: "CLF", signature: "cap-80-2026-10", status: "IGNORED" } });
  });

  it("al llegar al 100 % avisa ese umbral una vez, sin repetir el de 80 %", async () => {
    m.spent = 25_000_000;
    await notifyCapThresholds(OCT);
    m.spent = 30_000_000;
    await notifyCapThresholds(OCT);
    await notifyCapThresholds(OCT);
    expect(m.tg).toHaveBeenCalledTimes(2);
    expect(m.tg.mock.calls[1]![1]).toBe(
      "🛑 DNX Bot llegó al tope mensual: deja de responder con IA hasta el 1/11; los fotógrafos ven la opción de abrir un ticket.",
    );
  });

  it("si salta directo al 100 % manda los dos avisos", async () => {
    m.spent = 31_000_000;
    await notifyCapThresholds(OCT);
    expect(m.tg.mock.calls.map((c) => String(c[1]).slice(0, 2))).toEqual(["⚠️", "🛑"]);
  });

  it("en un mes nuevo vuelve a avisar", async () => {
    m.spent = 25_000_000;
    await notifyCapThresholds(OCT);
    await notifyCapThresholds(NOV);
    expect(m.tg).toHaveBeenCalledTimes(2);
    expect([...m.signatures]).toEqual(["cap-80-2026-10", "cap-80-2026-11"]);
  });

  it("diciembre anuncia el 1/01", async () => {
    m.spent = 30_000_000;
    await notifyCapThresholds(new Date("2026-12-10T15:00:00Z"));
    expect(m.tg.mock.calls[1]![1]).toContain("hasta el 1/01;");
  });

  it("nunca lanza: ni si Telegram falla ni si falla la base", async () => {
    m.spent = 30_000_000;
    m.tg.mockRejectedValue(new Error("telegram caído"));
    await expect(notifyCapThresholds(OCT)).resolves.toBeUndefined();
    m.tg.mockResolvedValue({ ok: false, error: "http_500" });
    await expect(notifyCapThresholds(NOV)).resolves.toBeUndefined();
    m.create.mockRejectedValue(new Error("base caída"));
    await expect(notifyCapThresholds(new Date("2026-12-10T15:00:00Z"))).resolves.toBeUndefined();
  });
});
