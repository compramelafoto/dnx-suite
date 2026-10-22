import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ vista: vi.fn(), slug: vi.fn(), freno: vi.fn(), playlist: vi.fn() }));
vi.mock("@/lib/digitalizacion/servidor/videos-publicos", () => ({ vistaDeEntregaPublica: H.vista }));
vi.mock("@/lib/digitalizacion/servidor/almacen", () => ({ playlistHlsFirmada: H.playlist }));
vi.mock("@/lib/presupuestos/sitio", () => ({ workspaceDelSlug: H.slug }));
vi.mock("@/lib/geocode/rate-limit", () => ({ checkRateLimit: H.freno, clientIp: () => "1.2.3.4" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { GET } = await import("./route");

const params = Promise.resolve({ workspaceSlug: "fp", token: "t".repeat(43), grabacionId: "g1" });
const pedir = () => GET(new Request("https://fotoffice.test/x") as never, { params });

beforeEach(() => {
  vi.clearAllMocks();
  H.slug.mockResolvedValue("ws1");
  H.freno.mockReturnValue({ allowed: true });
});

describe("playlist pública", () => {
  it("todo bien: la playlist firmada, como HLS y sin caché", async () => {
    H.vista.mockResolvedValue({ ok: true, hlsKey: "digitalizacion/ws1/g1/hls", segundos: 600 });
    H.playlist.mockResolvedValue("#EXTM3U\nhttps://r2/seg\n#EXT-X-ENDLIST\n");
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/vnd.apple.mpegurl");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(await r.text()).toContain("https://r2/seg");
    expect(H.vista).toHaveBeenCalledWith("ws1", "t".repeat(43), "g1");
    expect(H.playlist).toHaveBeenCalledWith("digitalizacion/ws1/g1/hls", 600);
  });
  it("con saldo, cancelado o sin HLS: no firma nada", async () => {
    for (const [motivo, estado] of [["SALDO", 402], ["CANCELADO", 410], ["PREPARANDO", 404], ["BORRADO", 410]] as const) {
      H.vista.mockResolvedValue({ ok: false, motivo });
      const r = await pedir();
      expect(r.status).toBe(estado);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(H.playlist).not.toHaveBeenCalled();
  });
  it("la playlist no está en R2: 404", async () => {
    H.vista.mockResolvedValue({ ok: true, hlsKey: "digitalizacion/ws1/g1/hls", segundos: 600 });
    H.playlist.mockResolvedValue(null);
    expect((await pedir()).status).toBe(404);
  });
  it("slug desconocido o freno por IP: no toca la entrega", async () => {
    H.slug.mockResolvedValue(null);
    expect((await pedir()).status).toBe(404);
    H.slug.mockResolvedValue("ws1");
    H.freno.mockReturnValue({ allowed: false });
    expect((await pedir()).status).toBe(429);
    expect(H.vista).not.toHaveBeenCalled();
  });
});
