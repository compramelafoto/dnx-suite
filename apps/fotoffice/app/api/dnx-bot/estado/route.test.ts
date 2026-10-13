import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ resolver: vi.fn() }));
vi.mock("@/lib/dnx-bot/acceso", () => ({ resolverBot: () => H.resolver() }));
import { GET } from "./route";

const CTX = {
  workspaceId: "ws1",
  capacidades: { configurar: true, gestionarPresupuestos: true, verConsultas: true },
};

beforeEach(() => {
  H.resolver.mockReset();
});

describe("GET /api/dnx-bot/estado", () => {
  it("con alguna puerta cerrada: { enabled: false }", async () => {
    H.resolver.mockResolvedValue({ ok: false, motivo: "interruptor" });
    const res = await GET(new Request("http://x/api/dnx-bot/estado"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false });
  });
  it("abierto: saludo y sugerencias según la pantalla (?pantalla= o la página de origen)", async () => {
    H.resolver.mockResolvedValue({ ok: true, ctx: CTX });
    const a = await (await GET(new Request("http://x/api/dnx-bot/estado?pantalla=precios"))).json();
    expect(a.enabled).toBe(true);
    expect(a.sugerencias[0]).toBe("Quiero armar mi perfil de precios conversando.");
    const b = await (
      await GET(new Request("http://x/api/dnx-bot/estado", { headers: { referer: "http://x/workspace/configuracion/precios" } }))
    ).json();
    expect(b.sugerencias[0]).toBe("Quiero armar mi perfil de precios conversando.");
  });
  it("si resolver falla, se apaga sin romper la página", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    H.resolver.mockImplementation(async () => { throw new Error("db"); });
    expect(await (await GET(new Request("http://x/api/dnx-bot/estado"))).json()).toEqual({ enabled: false });
    log.mockRestore();
  });
});
