import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ enabled: { v: true } }));
vi.mock("@/lib/bot/comprador/config", () => ({
  readBuyerBotConfig: () => ({ enabled: m.enabled.v, effort: "low", maxIterations: 5 }),
}));
import { POST } from "./route";

const req = () =>
  new Request("http://x/api/bot/comprador/globito", { method: "POST", body: JSON.stringify({ campaign: "comprador_album", accion: "CLICKED" }) });

beforeEach(() => {
  m.enabled.v = true;
});

describe("POST /api/bot/comprador/globito", () => {
  it("encendido → 200 { ok: true } (el «una vez por visita» lo maneja el navegador)", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it("interruptor apagado → 404", async () => {
    m.enabled.v = false;
    expect((await POST(req())).status).toBe(404);
  });
});
