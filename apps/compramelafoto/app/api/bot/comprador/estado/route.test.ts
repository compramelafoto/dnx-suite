import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ enabled: { v: true }, piloto: vi.fn(), resolver: vi.fn(), prisma: vi.fn() }));
vi.mock("@/lib/bot/comprador/config", async (orig) => ({
  ...(await orig<object>()),
  readBuyerBotConfig: () => ({ enabled: m.enabled.v, effort: "low", maxIterations: 5 }),
  leerPilotoCompradores: () => m.piloto(),
}));
vi.mock("@/lib/bot/comprador/pagina-datos", () => ({ resolverPagina: (...a: unknown[]) => m.resolver(...a) }));
vi.mock("@/lib/hidden-album-audit", () => ({ hashIp: (ip: string) => `hash(${ip})` }));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: () => m.prisma() }) }));
import { GET } from "./route";

const KEY = "0123456789abcdef0123456789abcdef";
const req = (pagePath: string, cookie?: string) =>
  new Request(`http://x/api/bot/comprador/estado?pagePath=${encodeURIComponent(pagePath)}`, {
    headers: cookie ? { cookie } : {},
  });

beforeEach(() => {
  m.enabled.v = true;
  m.piloto.mockReset();
  m.resolver.mockReset();
  m.prisma.mockReset();
  m.piloto.mockResolvedValue({ todos: false, albumIds: [5] });
  m.resolver.mockResolvedValue({ albumId: 5, orderId: null, enlace: null });
});

describe("GET /api/bot/comprador/estado", () => {
  it("interruptor apagado → { enabled: false } sin resolver la página ni tocar la base", async () => {
    m.enabled.v = false;
    const res = await GET(req("/a/5"));
    expect(await res.json()).toEqual({ enabled: false });
    expect(m.resolver).not.toHaveBeenCalled();
    expect(m.piloto).not.toHaveBeenCalled();
    expect(m.prisma).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("página no reconocida → { enabled: false }", async () => {
    expect(await (await GET(req("/fotografo/dashboard"))).json()).toEqual({ enabled: false });
  });
  it("álbum fuera del piloto → { enabled: false }", async () => {
    m.resolver.mockResolvedValue({ albumId: 9, orderId: null, enlace: null });
    expect(await (await GET(req("/a/9"))).json()).toEqual({ enabled: false });
  });
  it("habilitado sin cookie → saludo y Set-Cookie dnxbot_guest HttpOnly", async () => {
    const res = await GET(req("/a/5"));
    const body = await res.json();
    expect(body).toMatchObject({ enabled: true, alerta: false, progresoEscolar: null, globito: { campaign: "comprador_album" } });
    expect(typeof body.saludo).toBe("string");
    expect(Array.isArray(body.sugerencias)).toBe(true);
    const c = res.headers.get("set-cookie")!;
    expect(c).toContain("dnxbot_guest=");
    expect(c).toContain("HttpOnly");
  });
  it("habilitado con cookie válida → sin Set-Cookie", async () => {
    const res = await GET(req("/a/5", `dnxbot_guest=${KEY}`));
    expect((await res.json()).enabled).toBe(true);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("página de descarga → globito comprador_descarga a los 20 s", async () => {
    m.resolver.mockResolvedValue({ albumId: 5, orderId: 7, enlace: { tipo: "descarga", orderId: 7, albumId: 5 } });
    const body = await (await GET(req(`/descargas/${"b".repeat(32)}`, `dnxbot_guest=${KEY}`))).json();
    expect(body.globito.campaign).toBe("comprador_descarga");
    expect(body.globitoDemoraMs).toBe(20000);
  });
});
