import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), cfg: vi.fn(), build: vi.fn(), tg: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ assertCronAuth: (...a: unknown[]) => m.auth(...a) }));
vi.mock("@/lib/bot/config", () => ({ BOT_PLATFORM: "CLF", readBotConfig: () => m.cfg() }));
vi.mock("@/lib/bot/comparativa/reporte", () => ({ buildComparativa: (...a: unknown[]) => m.build(...a) }));
vi.mock("@repo/dnx-bot", () => ({ sendTelegramMessage: (...a: unknown[]) => m.tg(...a) }));
import { GET } from "./route";

const req = (q = "") => new Request(`http://x/api/cron/bot-comparativa${q}`) as unknown as NextRequest;
const prendido = { enabled: true, telegram: { token: "t", chatId: "c" } };

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.auth.mockReturnValue(null);
  m.cfg.mockReturnValue(prendido);
  m.build.mockResolvedValue("comparativa");
  m.tg.mockResolvedValue({ ok: true });
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("GET /api/cron/bot-comparativa", () => {
  it("sin autorización corta antes de todo (también con forzar)", async () => {
    m.auth.mockReturnValue(new Response("no", { status: 401 }));
    expect((await GET(req("?forzar=1"))).status).toBe(401);
    expect(m.build).not.toHaveBeenCalled();
    expect(m.tg).not.toHaveBeenCalled();
  });
  it("con el bot apagado no manda nada, ni forzado ni el 18/10", async () => {
    vi.setSystemTime(new Date("2026-10-18T13:00:00Z"));
    m.cfg.mockReturnValue({ ...prendido, enabled: false });
    expect(await (await GET(req("?forzar=1"))).json()).toEqual({ ok: true, skipped: true });
    expect(m.tg).not.toHaveBeenCalled();
  });
  it("un día común no manda", async () => {
    vi.setSystemTime(new Date("2026-10-20T13:00:00Z"));
    expect(await (await GET(req())).json()).toEqual({ ok: true, skipped: true });
    expect(m.build).not.toHaveBeenCalled();
    expect(m.tg).not.toHaveBeenCalled();
  });
  it("el 18/10/2026 manda la de fin de semana", async () => {
    vi.setSystemTime(new Date("2026-10-18T13:00:00Z"));
    expect(await (await GET(req())).json()).toEqual({ ok: true, tipo: "fin_de_semana", telegram: { ok: true } });
    expect(m.build.mock.calls[0]![0]).toBe("fin_de_semana");
    expect(m.tg).toHaveBeenCalledWith(prendido.telegram, "comparativa");
  });
  it("el día 1 manda la mensual", async () => {
    vi.setSystemTime(new Date("2026-12-01T13:00:00Z"));
    expect((await (await GET(req())).json()).tipo).toBe("mensual");
  });
  it("forzar=1 manda en el momento y acepta el tipo", async () => {
    vi.setSystemTime(new Date("2026-10-13T13:00:00Z"));
    expect((await (await GET(req("?forzar=1"))).json()).tipo).toBe("fin_de_semana");
    expect((await (await GET(req("?forzar=1&tipo=mensual"))).json()).tipo).toBe("mensual");
    expect(await (await GET(req("?forzar=0"))).json()).toEqual({ ok: true, skipped: true });
    expect(m.tg).toHaveBeenCalledTimes(2);
  });
});
