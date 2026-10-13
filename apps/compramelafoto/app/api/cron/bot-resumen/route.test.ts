import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), cfg: vi.fn(), upd: vi.fn(), del: vi.fn(), summary: vi.fn(), tg: vi.fn(), codes: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ assertCronAuth: (...a: unknown[]) => m.auth(...a) }));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF", readBotConfig: () => m.cfg() }));
vi.mock("@/lib/bot/resumen", () => ({ buildDailySummary: (...a: unknown[]) => m.summary(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { botAction: { updateMany: (...a: unknown[]) => m.upd(...a) }, botConversation: { deleteMany: (...a: unknown[]) => m.del(...a) },
    botEmailCode: { deleteMany: (...a: unknown[]) => m.codes(...a) },
  },
}));
vi.mock("@repo/dnx-bot", () => ({ sendTelegramMessage: (...a: unknown[]) => m.tg(...a) }));
import { GET } from "./route";

const req = () => new Request("http://x/api/cron/bot-resumen") as unknown as NextRequest;
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.auth.mockReturnValue(null);
  m.upd.mockResolvedValue({ count: 1 });
  m.del.mockResolvedValue({ count: 2 });
  m.codes.mockResolvedValue({ count: 4 });
  m.summary.mockResolvedValue("resumen");
  m.tg.mockResolvedValue({ ok: true });
});

describe("GET /api/cron/bot-resumen", () => {
  it("sin autorización corta antes de todo", async () => {
    m.auth.mockReturnValue(new Response("no", { status: 401 }));
    expect((await GET(req())).status).toBe(401);
    expect(m.cfg).not.toHaveBeenCalled();
  });
  it("con el bot apagado no limpia, no arma el resumen ni manda Telegram", async () => {
    m.cfg.mockReturnValue({ enabled: false, telegram: { token: "t", chatId: "c" } });
    const res = await GET(req());
    expect(await res.json()).toEqual({ ok: true, skipped: true });
    expect(m.upd).not.toHaveBeenCalled();
    expect(m.del).not.toHaveBeenCalled();
    expect(m.codes).not.toHaveBeenCalled();
    expect(m.summary).not.toHaveBeenCalled();
    expect(m.tg).not.toHaveBeenCalled();
  });
  it("con el bot prendido vence acciones, purga y manda el resumen", async () => {
    m.cfg.mockReturnValue({ enabled: true, telegram: { token: "t", chatId: "c" } });
    const res = await GET(req());
    expect(await res.json()).toEqual({ ok: true, expired: 1, purged: 2, telegram: { ok: true } });
    expect(m.tg).toHaveBeenCalledWith({ token: "t", chatId: "c" }, "resumen");
  });
  it("borra los códigos por mail de más de 2 días", async () => {
    m.cfg.mockReturnValue({ enabled: true, telegram: { token: "t", chatId: "c" } });
    const antes = Date.now();
    await GET(req());
    expect(m.codes).toHaveBeenCalledTimes(1);
    const corte: Date = m.codes.mock.calls[0]![0].where.createdAt.lt;
    expect(Object.keys(m.codes.mock.calls[0]![0].where)).toEqual(["createdAt"]);
    const DOS_DIAS = 2 * 24 * 60 * 60 * 1000;
    expect(corte.getTime()).toBeGreaterThanOrEqual(antes - DOS_DIAS);
    expect(corte.getTime()).toBeLessThanOrEqual(Date.now() - DOS_DIAS);
  });
});
