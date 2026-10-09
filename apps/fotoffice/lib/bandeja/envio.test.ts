import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { enviarTexto } = await import("./envio");

const REAL = { workspaceId: "w1", modo: "REAL" as const, phoneNumberId: "106540352242922" };
const json = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status });
const conToken = async () => "EAAG-token";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("enviarTexto", () => {
  it("modo simulado: no toca la red", async () => {
    const f = vi.fn();
    const r = await enviarTexto({ ...REAL, modo: "SIMULADO" }, "5493413419869", "hola", { fetch: f as never, leerToken: conToken });
    expect(r).toEqual({ ok: true, simulado: true });
    expect(f).not.toHaveBeenCalled();
  });

  it("REAL sin phoneNumberId o sin token: simulado", async () => {
    const f = vi.fn();
    expect(await enviarTexto({ ...REAL, phoneNumberId: null }, "549", "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: true, simulado: true });
    expect(await enviarTexto(REAL, "549", "hola", { fetch: f as never, leerToken: async () => null })).toEqual({ ok: true, simulado: true });
    expect(f).not.toHaveBeenCalled();
  });

  it("REAL: POST a la Graph API con el cuerpo de texto y devuelve el waMessageId", async () => {
    const f = vi.fn(async () => json(200, { messages: [{ id: "wamid.XYZ" }] }));
    const r = await enviarTexto(REAL, "5493413419869", "hola Lucía", { fetch: f as never, leerToken: conToken });
    expect(r).toEqual({ ok: true, simulado: false, waMessageId: "wamid.XYZ" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/106540352242922/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer EAAG-token");
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp", recipient_type: "individual", to: "5493413419869", type: "text",
      text: { preview_url: false, body: "hola Lucía" },
    });
  });

  it("usa la versión de WHATSAPP_API_VERSION", async () => {
    vi.stubEnv("WHATSAPP_API_VERSION", "v23.0");
    const f = vi.fn(async () => json(200, { messages: [{ id: "wamid.1" }] }));
    await enviarTexto(REAL, "549", "x", { fetch: f as never, leerToken: conToken });
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain("/v23.0/");
  });

  it("error de Meta: devuelve su código, sin lanzar", async () => {
    const f = vi.fn(async () => json(400, { error: { code: 131047, message: "texto privado del error" } }));
    expect(await enviarTexto(REAL, "549", "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: false, codigo: "131047" });
  });

  it("error HTTP sin cuerpo de Meta: el código es el HTTP", async () => {
    const f = vi.fn(async () => new Response("<html>", { status: 502 }));
    expect(await enviarTexto(REAL, "549", "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: false, codigo: "502" });
  });

  it("falla de red: RED, sin lanzar y sin loguear el texto ni el token", async () => {
    const consola = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "log")];
    const f = vi.fn(async () => { throw new Error("ECONNRESET hola EAAG-token"); });
    expect(await enviarTexto(REAL, "5493413419869", "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: false, codigo: "RED" });
    for (const c of consola) expect(c).not.toHaveBeenCalled();
  });

  it("respuesta 200 sin id: SIN_ID", async () => {
    const f = vi.fn(async () => json(200, {}));
    expect(await enviarTexto(REAL, "549", "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: false, codigo: "SIN_ID" });
  });
});
