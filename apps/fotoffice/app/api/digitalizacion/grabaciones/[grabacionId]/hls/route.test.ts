import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ ctx: vi.fn(), hls: vi.fn(), playlist: vi.fn() }));
vi.mock("@/lib/digitalizacion/contexto", () => ({ contextoDigitalizacion: H.ctx }));
vi.mock("@/lib/digitalizacion/servidor/grabaciones", () => ({ hlsDeGrabacion: H.hls }));
vi.mock("@/lib/digitalizacion/servidor/almacen", () => ({ playlistHlsFirmada: H.playlist }));

const { GET } = await import("./route");

const pedir = () => GET(new Request("https://fotoffice.test/x") as never, { params: Promise.resolve({ grabacionId: "g1" }) });

beforeEach(() => vi.clearAllMocks());

describe("playlist interna", () => {
  it("con permiso de ver Digitalización en el negocio: la playlist firmada por 4 h", async () => {
    H.ctx.mockResolvedValue({ workspaceId: "ws1", userId: 1 });
    H.hls.mockResolvedValue({ ok: true, hlsKey: "digitalizacion/ws1/g1/hls" });
    H.playlist.mockResolvedValue("#EXTM3U\n");
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/vnd.apple.mpegurl");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(H.ctx).toHaveBeenCalledWith("VIEW");
    expect(H.hls).toHaveBeenCalledWith({ workspaceId: "ws1", userId: 1 }, "g1");
    expect(H.playlist).toHaveBeenCalledWith("digitalizacion/ws1/g1/hls");
  });
  it("sin sesión o sin permiso: 403 sin buscar la grabación", async () => {
    H.ctx.mockResolvedValue(null);
    expect((await pedir()).status).toBe(403);
    expect(H.hls).not.toHaveBeenCalled();
  });
  it("de otro negocio o sin HLS: 404", async () => {
    H.ctx.mockResolvedValue({ workspaceId: "ws1", userId: 1 });
    H.hls.mockResolvedValue({ ok: false, error: "No encontramos esa grabación." });
    expect((await pedir()).status).toBe(404);
    expect(H.playlist).not.toHaveBeenCalled();
  });
});
