import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), enviar: vi.fn(), prisma: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ assertCronAuth: (...a: unknown[]) => m.auth(...a) }));
vi.mock("@/lib/bot/outreach-email", () => ({ enviarMailsOutreach: (...a: unknown[]) => m.enviar(...a) }));
// Cualquier acceso a prisma desde la ruta se registraría acá.
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_t, k) => { m.prisma(k); return {}; } }) }));
import { GET } from "./route";

const req = () => new Request("http://x/api/cron/bot-outreach") as unknown as NextRequest;
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.auth.mockReturnValue(null);
  m.enviar.mockResolvedValue({ candidatos: 2, enviados: 2, fallidos: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/bot-outreach", () => {
  it("sin autorización corta antes de todo", async () => {
    m.auth.mockReturnValue(new Response("no", { status: 401 }));
    expect((await GET(req())).status).toBe(401);
    expect(m.enviar).not.toHaveBeenCalled();
  });
  it.each([
    [undefined, undefined],
    ["1", undefined],
    [undefined, "1"],
    ["0", "1"],
    ["1", "0"],
  ])("apagado (CLF_BOT_ENABLED=%s, OUTREACH=%s): no consulta ni envía", async (bot, mail) => {
    vi.stubEnv("CLF_BOT_ENABLED", bot as string);
    vi.stubEnv("CLF_BOT_OUTREACH_EMAIL_ENABLED", mail as string);
    const res = await GET(req());
    expect(await res.json()).toEqual({ ok: true, skipped: true });
    expect(m.enviar).not.toHaveBeenCalled();
    expect(m.prisma).not.toHaveBeenCalled();
  });
  it("con los dos interruptores prendidos manda y devuelve el resumen", async () => {
    vi.stubEnv("CLF_BOT_ENABLED", "1");
    vi.stubEnv("CLF_BOT_OUTREACH_EMAIL_ENABLED", "1");
    const res = await GET(req());
    expect(await res.json()).toEqual({ ok: true, candidatos: 2, enviados: 2, fallidos: 0 });
    expect(m.enviar).toHaveBeenCalledTimes(1);
  });
});
