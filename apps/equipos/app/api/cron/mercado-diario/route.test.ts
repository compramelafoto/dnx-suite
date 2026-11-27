import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ expire: vi.fn(), alerts: vi.fn() }));
vi.mock("@/lib/ventas/ventas", () => ({ expirePendingSales: m.expire }));
vi.mock("@/lib/catalogo/alertas", () => ({ runSearchAlerts: m.alerts }));

import { GET } from "./route";

const pedido = (token?: string) =>
  new Request("http://x/api", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s";
  m.expire.mockResolvedValue({ expired: 2 });
  m.alerts.mockResolvedValue({ emails: 5 });
});

describe("cron mercado-diario", () => {
  it("sin el secreto correcto -> 401 y no hace nada", async () => {
    expect((await GET(pedido("otro"))).status).toBe(401);
    expect((await GET(pedido())).status).toBe(401);
    expect(m.expire).not.toHaveBeenCalled();
    expect(m.alerts).not.toHaveBeenCalled();
  });

  it("sin CRON_SECRET configurado -> 503", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(pedido("s"))).status).toBe(503);
    expect(m.expire).not.toHaveBeenCalled();
  });

  it("corre los dos trabajos y devuelve los conteos", async () => {
    const res = await GET(pedido("s"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, expired: 2, emails: 5 });
  });

  it("si falla el vencimiento de ventas, las alertas corren igual (500)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.expire.mockRejectedValue(new Error("caído"));
    const res = await GET(pedido("s"));
    expect(m.alerts).toHaveBeenCalledOnce();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "mercado_failed", emails: 5 });
  });

  it("si fallan las alertas, el vencimiento ya corrió (500)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.alerts.mockRejectedValue(new Error("caído"));
    const res = await GET(pedido("s"));
    expect(m.expire).toHaveBeenCalledOnce();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "mercado_failed", expired: 2 });
  });
});
