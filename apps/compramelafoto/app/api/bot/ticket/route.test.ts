import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), enabled: vi.fn(), conv: vi.fn(), escalate: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/config", () => ({ isBotEnabledForUser: () => m.enabled(), readBotConfig: () => ({ model: "m" }) }));
vi.mock("@/lib/bot/store", () => ({ getOrCreateConversation: (...a: unknown[]) => m.conv(...a) }));
vi.mock("@/lib/bot/escalamiento", () => ({ escalateToHuman: (...a: unknown[]) => m.escalate(...a) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => m.rate(...a) }));
import { POST } from "./route";

const req = () => new Request("http://x/api/bot/ticket", { method: "POST", body: "{}" });
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.user.mockResolvedValue({ id: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" });
  m.enabled.mockResolvedValue(true);
  m.conv.mockResolvedValue({ id: "c1", status: "OPEN", supportTicketId: null });
  m.rate.mockReturnValue({ allowed: true, remaining: 2, resetAt: 0 });
  m.escalate.mockResolvedValue({ ticketId: 12, reused: false });
});

describe("POST /api/bot/ticket", () => {
  it("abre un ticket nuevo con límite por usuario", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticketId: 12, reused: false });
    expect(m.rate).toHaveBeenCalledWith({ key: "bot-ticket:7", limit: 3, windowMs: 3_600_000 });
    expect(m.escalate).toHaveBeenCalledTimes(1);
  });
  it("conversación ya derivada → devuelve el mismo ticket sin crear otro ni gastar el cupo", async () => {
    m.conv.mockResolvedValue({ id: "c1", status: "ESCALATED", supportTicketId: 44 });
    const res = await POST(req());
    expect(await res.json()).toEqual({ ticketId: 44, reused: true });
    expect(m.escalate).not.toHaveBeenCalled();
    expect(m.rate).not.toHaveBeenCalled();
  });
  it("pasado el límite → 429 con mensaje amable, sin crear ticket", async () => {
    m.rate.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/última hora/);
    expect(m.escalate).not.toHaveBeenCalled();
  });
  it("bot apagado → 404", async () => {
    m.enabled.mockResolvedValue(false);
    expect((await POST(req())).status).toBe(404);
    expect(m.conv).not.toHaveBeenCalled();
  });
});
