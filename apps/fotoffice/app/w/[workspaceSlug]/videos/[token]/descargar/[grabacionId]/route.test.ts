import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ registrar: vi.fn(), slug: vi.fn(), freno: vi.fn() }));
vi.mock("@/lib/digitalizacion/servidor/videos-publicos", () => ({ registrarDescarga: H.registrar }));
vi.mock("@/lib/presupuestos/sitio", () => ({ workspaceDelSlug: H.slug }));
vi.mock("@/lib/geocode/rate-limit", () => ({ checkRateLimit: H.freno, clientIp: () => "1.2.3.4" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { GET, HEAD } = await import("./route");

const params = Promise.resolve({ workspaceSlug: "fp", token: "t".repeat(43), grabacionId: "g1" });
const pedir = () => GET(new Request("https://fotoffice.test/x") as never, { params });

beforeEach(() => {
  vi.clearAllMocks();
  H.slug.mockResolvedValue("ws1");
  H.freno.mockReturnValue({ allowed: true });
});

describe("descarga contada", () => {
  it("todo bien: 302 a la URL firmada, sin caché", async () => {
    H.registrar.mockResolvedValue({ ok: true, url: "https://r2/firmada" });
    const r = await pedir();
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://r2/firmada");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(H.registrar).toHaveBeenCalledWith("ws1", "t".repeat(43), "g1");
  });
  it("con saldo o sin cupo: una página clara, sin redirigir", async () => {
    H.registrar.mockResolvedValue({ ok: false, motivo: "SALDO" });
    const r = await pedir();
    expect(r.status).toBe(402);
    expect(await r.text()).toContain("pagar el saldo");
    H.registrar.mockResolvedValue({ ok: false, motivo: "SIN_CUPO" });
    expect(await (await pedir()).text()).toContain("Ya usaste todas las descargas");
  });
  it("slug desconocido: 404 sin tocar la entrega", async () => {
    H.slug.mockResolvedValue(null);
    expect((await pedir()).status).toBe(404);
    expect(H.registrar).not.toHaveBeenCalled();
  });
  it("freno por IP: 429", async () => {
    H.freno.mockReturnValue({ allowed: false });
    expect((await pedir()).status).toBe(429);
    expect(H.registrar).not.toHaveBeenCalled();
  });
  it("HEAD no cuenta una descarga", async () => {
    expect((await HEAD()).status).toBe(405);
    expect(H.registrar).not.toHaveBeenCalled();
  });
});
