import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ enabled: { v: true }, token: vi.fn(), historia: vi.fn(), user: vi.fn(), ticket: vi.fn() }));
vi.mock("@/lib/bot/comprador/config", () => ({ readBuyerBotConfig: () => ({ enabled: m.enabled.v }) }));
vi.mock("@/lib/soporte/token-caso", () => ({ leerTokenCaso: (...a: unknown[]) => m.token(...a) }));
vi.mock("@/lib/soporte/caso-bot", () => ({ historiaDeCaso: (...a: unknown[]) => m.historia(...a) }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/prisma", () => ({ prisma: { supportTicket: { findUnique: (...a: unknown[]) => m.ticket(...a) } } }));
import { GET as GETComprador } from "./route";
import { GET as GETFotografo } from "../../caso/route";

const req = (url: string) => new Request(url) as never;
const historia = { ticket: { id: 60, estado: "WAITING_CUSTOMER" }, items: [{ rol: "equipo", texto: "Hola", autor: "Daniel · equipo CompraMeLaFoto", fecha: "x" }] };

beforeEach(() => {
  m.enabled.v = true;
  for (const f of [m.token, m.historia, m.user, m.ticket]) f.mockReset();
  m.historia.mockResolvedValue(historia);
});

describe("GET /api/bot/comprador/caso", () => {
  it("token válido → la historia del caso", async () => {
    m.token.mockResolvedValue({ ticketId: 60 });
    const res = await GETComprador(req("http://x/api/bot/comprador/caso?token=tok"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(historia);
  });
  it("token vencido o inventado → 404 sin datos del caso", async () => {
    m.token.mockResolvedValue(null);
    const res = await GETComprador(req("http://x/api/bot/comprador/caso?token=nada"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "caso_vencido" });
    expect(m.historia).not.toHaveBeenCalled();
  });
  it("bot de compradores apagado → 404", async () => {
    m.enabled.v = false;
    expect((await GETComprador(req("http://x/api/bot/comprador/caso?token=tok"))).status).toBe(404);
  });
});

describe("GET /api/bot/caso (fotógrafos)", () => {
  it("sin sesión → 401; caso de otra cuenta → 403; propio → historia", async () => {
    m.token.mockResolvedValue({ ticketId: 55 });
    m.ticket.mockResolvedValue({ requesterEmail: "Foto@x.com" });
    m.user.mockResolvedValue(null);
    expect((await GETFotografo(req("http://x/api/bot/caso?token=tok"))).status).toBe(401);
    m.user.mockResolvedValue({ id: 8, email: "otro@x.com" });
    expect((await GETFotografo(req("http://x/api/bot/caso?token=tok"))).status).toBe(403);
    m.user.mockResolvedValue({ id: 7, email: "foto@x.com" });
    const ok = await GETFotografo(req("http://x/api/bot/caso?token=tok"));
    expect(ok.status).toBe(200);
    expect(m.historia).toHaveBeenCalledTimes(1);
  });
});
