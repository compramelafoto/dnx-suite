import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), enabled: vi.fn(), cfg: vi.fn(), sit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/config", () => ({ isBotEnabledForUser: () => m.enabled(), readBotConfig: () => m.cfg() }));
vi.mock("@/lib/bot/contexto", () => ({ buildPhotographerSituation: (...a: unknown[]) => m.sit(...a) }));
import { GET } from "./route";

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.cfg.mockReturnValue({ enabled: true });
  m.user.mockResolvedValue({ id: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" });
  m.enabled.mockResolvedValue(true);
});

describe("GET /api/bot/estado", () => {
  it("bot apagado → no lee la sesión", async () => {
    m.cfg.mockReturnValue({ enabled: false });
    expect(await (await GET()).json()).toEqual({ enabled: false });
    expect(m.user).not.toHaveBeenCalled();
  });
  it("alerta que bloquea ventas → saludo con la alerta", async () => {
    m.sit.mockResolvedValue({ alerts: [{ level: "bloquea_ventas", text: "No tenés Mercado Pago conectado." }] });
    const r = await (await GET()).json();
    expect(r).toMatchObject({ enabled: true, alerta: true });
    expect(r.saludo).toContain("Mercado Pago");
  });
  it("si falla armar la situación → saludo neutro, sin romper", async () => {
    m.sit.mockRejectedValue(new Error("db caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ enabled: true, alerta: false, saludo: "Hola, soy DNX Bot. ¿En qué te ayudo?" });
  });
});
