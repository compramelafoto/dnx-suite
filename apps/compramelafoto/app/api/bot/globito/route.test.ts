import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), enabled: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/config", () => ({ isBotEnabledForUser: () => m.enabled(), BOT_PLATFORM: "CLF" }));
vi.mock("@/lib/prisma", () => ({ prisma: { botOutreach: { upsert: (...a: unknown[]) => m.upsert(...a) } } }));
import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://x/api/bot/globito", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.user.mockResolvedValue({ id: 7, role: "PHOTOGRAPHER" });
  m.enabled.mockResolvedValue(true);
  m.upsert.mockResolvedValue({});
});

describe("POST /api/bot/globito", () => {
  it("401 sin sesión", async () => {
    m.user.mockResolvedValue(null);
    expect((await post({ campaign: "nuevo", accion: "CLICKED" })).status).toBe(401);
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("404 con el bot apagado", async () => {
    m.enabled.mockResolvedValue(false);
    expect((await post({ campaign: "nuevo", accion: "CLICKED" })).status).toBe(404);
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("400 por campaña, acción o cuerpo inválidos", async () => {
    for (const b of [{ campaign: "x", accion: "CLICKED" }, { campaign: "nuevo", accion: "SHOWN" }, { campaign: "nuevo" }, {}, "no-json"]) {
      expect((await post(b)).status).toBe(400);
    }
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("registra con upsert por usuario/campaña/canal (dos llamadas → misma clave)", async () => {
    const body = { campaign: "sin_escolar", accion: "DECLINED", answer: " no uso " };
    expect(await (await post(body)).json()).toEqual({ ok: true });
    await post(body);
    expect(m.upsert).toHaveBeenCalledTimes(2);
    const a = m.upsert.mock.calls[0][0];
    expect(a.where).toEqual(m.upsert.mock.calls[1][0].where);
    expect(a.where.platform_userId_campaign_channel).toMatchObject({ userId: 7, campaign: "sin_escolar", channel: "PANEL" });
    expect(a.create).toMatchObject({ status: "DECLINED", answer: "no uso" });
    expect(a.update).toMatchObject({ status: "DECLINED", answer: "no uso" });
  });
});
