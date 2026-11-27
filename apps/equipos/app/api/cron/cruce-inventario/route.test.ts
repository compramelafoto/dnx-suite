import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ matches: vi.fn(), hold: vi.fn() }));
vi.mock("@/lib/inventario/denuncias", () => ({ notifyNewInventoryMatches: m.matches }));
vi.mock("@/lib/publicaciones/moderacion", () => ({ holdListingsWithActiveReports: m.hold }));

import { GET } from "./route";

const pedido = (token?: string) =>
  new Request("http://x/api", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s";
  m.matches.mockResolvedValue({ matches: 2, notified: 1 });
  m.hold.mockResolvedValue({ held: 3 });
});

describe("cron cruce-inventario", () => {
  it("sin el secreto correcto -> 401 y no hace nada", async () => {
    expect((await GET(pedido("otro"))).status).toBe(401);
    expect(m.matches).not.toHaveBeenCalled();
    expect(m.hold).not.toHaveBeenCalled();
  });

  it("devuelve lo de siempre y suma { held }", async () => {
    const res = await GET(pedido("s"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, matches: 2, notified: 1, held: 3 });
  });
});
