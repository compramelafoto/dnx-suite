import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), tg: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { supportTicket: { findUnique: (...a: unknown[]) => m.find(...a), update: (...a: unknown[]) => m.update(...a) } },
}));
vi.mock("@repo/dnx-bot", async (orig) => ({ ...(await orig<object>()), sendTelegramMessage: (...a: unknown[]) => m.tg(...a) }));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF", readBotConfig: () => ({ telegram: { token: "t", chatId: "c" } }) }));
import { aplicarEvento } from "./aplicar-evento";
import { avisarSoporte } from "./avisos";

const now = new Date("2026-10-26T12:00:00.000Z");
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.update.mockResolvedValue({});
  m.tg.mockResolvedValue({ ok: true });
});

describe("aplicarEvento", () => {
  it("guarda el cambio sin la clave aviso y avisa una sola vez", async () => {
    m.find.mockResolvedValue({ id: 60, status: "WAITING_CUSTOMER" });
    const r = await aplicarEvento(60, { tipo: "CLIENTE_ESCRIBIO_PANEL" }, now);
    expect(r).toMatchObject({ status: "IN_PROGRESS" });
    expect(m.update).toHaveBeenCalledTimes(1);
    const data = m.update.mock.calls[0]![0].data;
    expect(m.update.mock.calls[0]![0].where).toEqual({ id: 60 });
    expect(data).not.toHaveProperty("aviso");
    expect(data).toMatchObject({ status: "IN_PROGRESS", slaDesde: now, clienteRespondioAt: now });
    expect(m.tg).toHaveBeenCalledTimes(1);
    expect(m.tg.mock.calls[0]![1]).toContain("#60");
  });

  it("si el evento se rechaza no toca la base ni avisa", async () => {
    m.find.mockResolvedValue({ id: 61, status: "CLOSED" });
    const r = await aplicarEvento(61, { tipo: "CLIENTE_ESCRIBIO_PANEL" }, now);
    expect(r).toHaveProperty("rechazado");
    expect(m.update).not.toHaveBeenCalled();
    expect(m.tg).not.toHaveBeenCalled();
  });

  it("ticket inexistente → rechazado", async () => {
    m.find.mockResolvedValue(null);
    expect(await aplicarEvento(999, { tipo: "ADMIN_RESPONDIO" }, now)).toHaveProperty("rechazado");
  });
});

describe("avisarSoporte", () => {
  it("nunca lanza aunque Telegram falle", async () => {
    m.tg.mockRejectedValue(new Error("caído"));
    await expect(avisarSoporte("hola")).resolves.toBeUndefined();
  });
});
