import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ enabled: { v: true }, piloto: vi.fn(), resolver: vi.fn() }));
vi.mock("./config", async (orig) => ({
  ...(await orig<object>()),
  readBuyerBotConfig: () => ({ enabled: m.enabled.v, effort: "low", maxIterations: 5 }),
  leerPilotoCompradores: () => m.piloto(),
}));
vi.mock("./pagina-datos", () => ({ resolverPagina: (...a: unknown[]) => m.resolver(...a) }));
vi.mock("@/lib/hidden-album-audit", () => ({ hashIp: (ip: string) => `hash(${ip})` }));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { actorDesdeConversacion, habilitacionComprador, headersInvitado, invitadoDe } from "./contexto-pedido";

const TOKEN = "a".repeat(32);
const KEY = "0123456789abcdef0123456789abcdef";

beforeEach(() => {
  m.enabled.v = true;
  m.piloto.mockReset();
  m.resolver.mockReset();
  m.piloto.mockResolvedValue({ todos: false, albumIds: [5] });
  m.resolver.mockResolvedValue({ albumId: 5, orderId: null, enlace: null });
});

describe("habilitacionComprador", () => {
  it("interruptor apagado → no habilitado sin tocar la base", async () => {
    m.enabled.v = false;
    expect(await habilitacionComprador("/a/5")).toEqual({ habilitado: false });
    expect(m.piloto).not.toHaveBeenCalled();
    expect(m.resolver).not.toHaveBeenCalled();
  });
  it("pagePath que no es texto o página sin bot → no habilitado", async () => {
    expect(await habilitacionComprador(undefined)).toEqual({ habilitado: false });
    expect(await habilitacionComprador(42)).toEqual({ habilitado: false });
    expect(await habilitacionComprador("/album/x/comprar")).toEqual({ habilitado: false });
    expect(m.resolver).not.toHaveBeenCalled();
  });
  it("álbum fuera del piloto → no habilitado", async () => {
    m.resolver.mockResolvedValue({ albumId: 9, orderId: null, enlace: null });
    expect(await habilitacionComprador("/a/9")).toEqual({ habilitado: false });
  });
  it("piloto apagado (null) → no habilitado", async () => {
    m.piloto.mockResolvedValue(null);
    expect(await habilitacionComprador("/a/5")).toEqual({ habilitado: false });
  });
  it("habilitado → página, datos y la ruta segura (sin el token)", async () => {
    const enlace = { tipo: "descarga", orderId: 77, albumId: 5 };
    m.resolver.mockResolvedValue({ albumId: 5, orderId: 77, enlace });
    const r = await habilitacionComprador(`/descargas/${TOKEN}`);
    expect(r).toEqual({
      habilitado: true,
      pagina: { tipo: "descarga", token: TOKEN },
      datos: { albumId: 5, orderId: 77, enlace },
      pagePath: "/descargas/[token]",
    });
    expect(JSON.stringify((r as { pagePath: string }).pagePath)).not.toContain(TOKEN);
  });
});

describe("invitadoDe / headersInvitado", () => {
  const req = (cookie?: string) =>
    new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1", ...(cookie ? { cookie } : {}) } });

  it("cookie válida → la reusa, sin Set-Cookie; ipHash = hashIp(ipDe(req))", () => {
    const i = invitadoDe(req(`otra=1; dnxbot_guest=${KEY}`));
    expect(i).toEqual({ guestKey: KEY, nueva: false, ipHash: "hash(1.2.3.4)" });
    expect(headersInvitado(i)).toEqual({});
  });
  it("sin cookie o inválida → una nueva con Set-Cookie HttpOnly", () => {
    for (const r of [req(), req("dnxbot_guest=XYZ")]) {
      const i = invitadoDe(r);
      expect(i.nueva).toBe(true);
      expect(i.guestKey).toMatch(/^[0-9a-f]{32}$/);
      const h = headersInvitado(i);
      expect(h["set-cookie"]).toContain(`dnxbot_guest=${i.guestKey}`);
      expect(h["set-cookie"]).toContain("HttpOnly");
    }
  });
});

describe("actorDesdeConversacion", () => {
  const conv = {
    id: "c1", status: "OPEN" as const, supportTicketId: null, buyerEmail: "ju@x.com",
    verifiedUntil: new Date(Date.now() + 60_000), ipHash: "h", albumId: 5, orderId: null,
  };
  it("arma el actor con el mail verificado de la conversación y el enlace de la página", async () => {
    const enlace = { tipo: "pack" as const, orderId: 3, albumId: 5 };
    const a = await actorDesdeConversacion({
      conv, guestKey: KEY, ipHash: "h2", pagina: { tipo: "album_id", albumId: 5, photoId: null }, pagePath: "/a/5",
      datos: { albumId: 5, orderId: 3, enlace }, sesion: null,
    });
    expect(a).toEqual({
      guestKey: KEY, ipHash: "h2", conversationId: "c1", pagina: { tipo: "album_id", albumId: 5, photoId: null }, pagePath: "/a/5",
      albumId: 5, enlace, emailVerificado: "ju@x.com", userId: null,
    });
  });
  it("la sesión gana y aporta el userId; verificación vencida → null", async () => {
    const a = await actorDesdeConversacion({
      conv, guestKey: KEY, ipHash: "h", pagina: null, pagePath: null, datos: { albumId: null, orderId: null, enlace: null },
      sesion: { email: "s@x.com", userId: 4 },
    });
    expect(a).toMatchObject({ emailVerificado: "s@x.com", userId: 4 });
    const b = await actorDesdeConversacion({
      conv: { ...conv, verifiedUntil: new Date(Date.now() - 1) }, guestKey: KEY, ipHash: "h", pagina: null, pagePath: null,
      datos: { albumId: null, orderId: null, enlace: null }, sesion: null,
    });
    expect(b.emailVerificado).toBeNull();
  });
});
