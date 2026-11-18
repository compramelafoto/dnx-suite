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

  it("REAL sin phoneNumberId o sin token usable: falla (no simula en silencio)", async () => {
    const f = vi.fn();
    expect(await enviarTexto({ ...REAL, phoneNumberId: null }, "549", "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: false, codigo: "SIN_NUMERO" });
    expect(await enviarTexto(REAL, "549", "hola", { fetch: f as never, leerToken: async () => null })).toEqual({ ok: false, codigo: "SIN_TOKEN" });
    expect(await enviarTexto(REAL, "549", "hola", { fetch: f as never, leerToken: async () => { throw new Error("x"); } })).toEqual({ ok: false, codigo: "SIN_TOKEN" });
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
      messaging_product: "whatsapp", recipient_type: "individual", to: "543413419869", type: "text",
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

  it("a los celulares de Argentina (549…) y México (521…) se les manda sin el 9 / 1, como pide Meta", async () => {
    const { destinoParaMeta } = await import("./envio");
    expect(destinoParaMeta("5493413748324")).toBe("543413748324");
    expect(destinoParaMeta("5215512345678")).toBe("525512345678");
    expect(destinoParaMeta("543413748324")).toBe("543413748324");
    expect(destinoParaMeta("15551984447")).toBe("15551984447");
    expect(destinoParaMeta("5511987654321")).toBe("5511987654321");
  });
});

describe("enviarTexto por canal", () => {
  const CON_IG = { ...REAL, igPageId: "1122334455", igActivo: true };

  it("con INSTAGRAM no toca la ruta de WhatsApp: va a la página de Instagram, sin messaging_product", async () => {
    const f = vi.fn(async () => json(200, { recipient_id: "5550001", message_id: "m_IG" }));
    const r = await enviarTexto(CON_IG, "5493413419869", "hola", { fetch: f as never, leerToken: conToken }, "INSTAGRAM");
    expect(r).toEqual({ ok: true, simulado: false, waMessageId: "m_IG" });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/1122334455/messages");
    expect(url).not.toContain("106540352242922");
    // El IGSID va tal cual (sin el ajuste del 9 de los celulares de WhatsApp).
    expect(JSON.parse(init.body as string)).toEqual({ recipient: { id: "5493413419869" }, message: { text: "hola" } });
  });

  it("con INSTAGRAM sin página: SIN_PAGINA aunque haya número de WhatsApp", async () => {
    const f = vi.fn();
    expect(await enviarTexto(REAL, "5550001", "hola", { fetch: f as never, leerToken: conToken }, "INSTAGRAM")).toEqual({ ok: false, codigo: "SIN_PAGINA" });
    expect(f).not.toHaveBeenCalled();
  });

  it("sin canal (o WHATSAPP) sigue siendo WhatsApp", async () => {
    const f = vi.fn(async () => json(200, { messages: [{ id: "wamid.W" }] }));
    expect(await enviarTexto(CON_IG, "5493413419869", "hola", { fetch: f as never, leerToken: conToken }, "WHATSAPP")).toEqual({ ok: true, simulado: false, waMessageId: "wamid.W" });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://graph.facebook.com/v21.0/106540352242922/messages");
  });
});
