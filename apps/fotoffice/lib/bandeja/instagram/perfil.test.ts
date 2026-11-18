import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/instagram/credentials", () => ({ leerTokenInstagram: vi.fn(async () => null) }));

const { perfilInstagram } = await import("./perfil");

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.WHATSAPP_API_VERSION;
});

describe("perfil de Instagram", () => {
  it("pide name y username al Graph con el token de la página", async () => {
    const fetch = vi.fn(async () => Response.json({ name: "Lucía Gómez", username: "luciag", id: "5550001" }));
    const r = await perfilInstagram("w1", "5550001", { fetch, leerToken: async () => "tok" });
    expect(r).toEqual({ nombre: "Lucía Gómez", usuario: "luciag" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/5550001?fields=name,username");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("respeta WHATSAPP_API_VERSION", async () => {
    process.env.WHATSAPP_API_VERSION = "v23.0";
    const fetch = vi.fn(async () => Response.json({}));
    await perfilInstagram("w1", "1", { fetch, leerToken: async () => "tok" });
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toContain("/v23.0/1?");
  });

  it("nunca lanza: sin token, error de Graph, red caída o respuesta rara → nulos, sin loguear token ni IGSID", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const vacio = { nombre: null, usuario: null };
    const fetch = vi.fn(async () => Response.json({}));
    expect(await perfilInstagram("w1", "5550001", { fetch, leerToken: async () => null })).toEqual(vacio);
    expect(fetch).not.toHaveBeenCalled();
    expect(await perfilInstagram("w1", "5550001", { fetch: async () => new Response("{}", { status: 400 }), leerToken: async () => "tok-secreto" })).toEqual(vacio);
    expect(await perfilInstagram("w1", "5550001", { fetch: async () => { throw new Error("red"); }, leerToken: async () => "tok-secreto" })).toEqual(vacio);
    expect(await perfilInstagram("w1", "5550001", { fetch: async () => Response.json({ name: 3, username: "" }), leerToken: async () => "tok-secreto" })).toEqual(vacio);
    expect(await perfilInstagram("w1", "5550001", { leerToken: async () => { throw new Error("baúl"); } })).toEqual(vacio);
    const escrito = JSON.stringify(log.mock.calls);
    expect(escrito).not.toContain("tok-secreto");
    expect(escrito).not.toContain("5550001");
  });
});
