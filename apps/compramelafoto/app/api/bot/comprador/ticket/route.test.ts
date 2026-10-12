import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ enabled: { v: true }, piloto: vi.fn(), buscar: vi.fn(), abrir: vi.fn(), user: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/hidden-album-audit", () => ({ hashIp: (ip: string) => `hash(${ip})` }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/comprador/config", async (orig) => ({
  ...(await orig<object>()),
  readBuyerBotConfig: () => ({ enabled: m.enabled.v, effort: "low", maxIterations: 5 }),
  leerPilotoCompradores: () => m.piloto(),
}));
vi.mock("@/lib/bot/comprador/pagina-datos", () => ({ resolverPagina: vi.fn() }));
vi.mock("@/lib/bot/comprador/store", () => ({ buscarConversacionComprador: (...a: unknown[]) => m.buscar(...a) }));
vi.mock("@/lib/bot/comprador/caso", () => ({ abrirCasoComprador: (...a: unknown[]) => m.abrir(...a) }));
import { POST } from "./route";

const KEY = "0123456789abcdef0123456789abcdef";
const SIN_MAIL = "Para derivarte necesito tu mail. Escribilo acá en el chat y abro el caso.";
const conv = {
  id: "cb1", status: "OPEN", supportTicketId: null, buyerEmail: "ju@x.com", verifiedUntil: new Date(Date.now() + 60_000),
  ipHash: "hash(9.9.9.9)", albumId: 5, orderId: 7,
};
const req = (body: unknown = {}, cookie: string | null = `dnxbot_guest=${KEY}`) =>
  new Request("http://x/api/bot/comprador/ticket", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-forwarded-for": "9.9.9.9", ...(cookie ? { cookie } : {}) },
  });

beforeEach(() => {
  m.enabled.v = true;
  for (const f of [m.piloto, m.buscar, m.abrir, m.user]) f.mockReset();
  m.piloto.mockResolvedValue({ todos: false, albumIds: [5] });
  m.buscar.mockResolvedValue(conv);
  m.abrir.mockResolvedValue({ ok: true, ticketId: 44, reused: false });
  m.user.mockResolvedValue(null);
});

describe("POST /api/bot/comprador/ticket", () => {
  it("interruptor apagado → 404", async () => {
    m.enabled.v = false;
    expect((await POST(req())).status).toBe(404);
    expect(m.buscar).not.toHaveBeenCalled();
  });
  it("sin cookie o sin conversación → 422 con el texto exacto", async () => {
    let res = await POST(req({}, null));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: SIN_MAIL });
    m.buscar.mockResolvedValue(null);
    res = await POST(req());
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: SIN_MAIL });
    expect(m.abrir).not.toHaveBeenCalled();
  });
  it("conversación sin mail verificado → 422", async () => {
    m.buscar.mockResolvedValue({ ...conv, verifiedUntil: new Date(Date.now() - 1) });
    const res = await POST(req());
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: SIN_MAIL });
  });
  it("álbum de la conversación fuera del piloto → 404", async () => {
    m.piloto.mockResolvedValue({ todos: false, albumIds: [1] });
    expect((await POST(req())).status).toBe(404);
    expect(m.abrir).not.toHaveBeenCalled();
  });
  it("conversación verificada → abre el caso con email null (usa el verificado)", async () => {
    const res = await POST(req({ resumen: "  No me llegó el mail  " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticketId: 44, reused: false });
    const p = m.abrir.mock.calls[0]![0];
    expect(p).toMatchObject({ email: null, resumen: "No me llegó el mail", urgente: false, motivo: "otro" });
    expect(p.actor).toMatchObject({ conversationId: "cb1", guestKey: KEY, ipHash: "hash(9.9.9.9)", emailVerificado: "ju@x.com", enlace: null });
  });
  it("sin resumen → texto por defecto", async () => {
    await POST(req());
    expect(m.abrir.mock.calls[0]![0].resumen).toBe("La persona pidió hablar con alguien del equipo desde DNX Bot.");
  });
  it("ya derivada → devuelve el mismo caso aunque no tenga mail verificado", async () => {
    m.buscar.mockResolvedValue({ ...conv, status: "ESCALATED", supportTicketId: 12, verifiedUntil: null });
    m.abrir.mockResolvedValue({ ok: true, ticketId: 12, reused: true });
    const res = await POST(req());
    expect(await res.json()).toEqual({ ticketId: 12, reused: true });
  });
  it("tope de casos por IP → 429 con el mensaje de abrirCasoComprador", async () => {
    m.abrir.mockResolvedValue({ ok: false, mensaje: "Ya abriste varios casos hoy. Te van a responder por mail a cada uno." });
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Ya abriste varios casos hoy. Te van a responder por mail a cada uno." });
  });
});
