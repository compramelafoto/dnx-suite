import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/integrations/instagram/credentials", () => ({ leerTokenInstagram: vi.fn(async () => null) }));

const { partirPorBytes, enviarTextoInstagram } = await import("./envio");

const bytes = (s: string) => Buffer.byteLength(s, "utf8");
const REAL = { workspaceId: "w1", modo: "REAL" as const, igPageId: "1122334455", igActivo: true };
const json = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status });
const conToken = async () => "EAAP-token-pagina";
const IGSID = "5550001";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("partir por bytes", () => {
  it("un texto corto queda en una sola parte", () => {
    expect(partirPorBytes("hola 😀")).toEqual(["hola 😀"]);
  });

  it("2.500 bytes con emojis: partes de ≤ 1000 bytes que unidas dan el texto, sin cortar un carácter", () => {
    // Bloques de palabras y emojis de 4 bytes (y uno compuesto) sin párrafos, para forzar cortes por espacio.
    let texto = "";
    while (bytes(texto) < 2500) texto += "foto 📸 casamiento 👩‍❤️‍👨 ";
    texto = texto.trim();
    const partes = partirPorBytes(texto);
    expect(partes.length).toBeGreaterThanOrEqual(3);
    for (const p of partes) {
      expect(bytes(p)).toBeLessThanOrEqual(1000);
      // Ningún carácter partido: re-codificar no cambia nada (un sustituto suelto se volvería U+FFFD).
      expect(Buffer.from(p, "utf8").toString("utf8")).toBe(p);
      expect(p).not.toMatch(/[\uD800-\uDBFF]$/);
      expect(p).not.toMatch(/^[\uDC00-\uDFFF]/);
    }
    expect(partes.join("")).toBe(texto);
    // Corta en un espacio, no en medio de una palabra.
    for (const p of partes.slice(0, -1)) expect(p).toMatch(/\s$/);
  });

  it("prefiere cortar en un párrafo", () => {
    const a = "a".repeat(600);
    const b = "b ".repeat(300);
    const texto = `${a}\n\n${b}`;
    const partes = partirPorBytes(texto);
    expect(partes[0]).toBe(`${a}\n\n`);
    expect(partes.join("")).toBe(texto);
  });

  it("sin espacios corta igual por carácter entero", () => {
    const texto = "😀".repeat(400); // 1.600 bytes
    const partes = partirPorBytes(texto);
    expect(partes.join("")).toBe(texto);
    for (const p of partes) {
      expect(bytes(p)).toBeLessThanOrEqual(1000);
      expect(bytes(p) % 4).toBe(0);
    }
  });

  it("respeta otro máximo", () => {
    const partes = partirPorBytes("uno dos tres cuatro", 8);
    expect(partes.join("")).toBe("uno dos tres cuatro");
    for (const p of partes) expect(bytes(p)).toBeLessThanOrEqual(8);
  });
});

describe("enviarTextoInstagram", () => {
  it("SIMULADO: no llama a fetch", async () => {
    const f = vi.fn();
    expect(await enviarTextoInstagram({ ...REAL, modo: "SIMULADO" }, IGSID, "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: true, simulado: true });
    expect(f).not.toHaveBeenCalled();
  });

  it("REAL sin página o sin Instagram activo: SIN_PAGINA; sin token: SIN_TOKEN", async () => {
    const f = vi.fn();
    expect(await enviarTextoInstagram({ ...REAL, igPageId: null }, IGSID, "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: false, codigo: "SIN_PAGINA" });
    expect(await enviarTextoInstagram({ ...REAL, igActivo: false }, IGSID, "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: false, codigo: "SIN_PAGINA" });
    expect(await enviarTextoInstagram(REAL, IGSID, "hola", { fetch: f as never, leerToken: async () => null })).toEqual({ ok: false, codigo: "SIN_TOKEN" });
    expect(await enviarTextoInstagram(REAL, IGSID, "hola", { fetch: f as never, leerToken: async () => { throw new Error("x"); } })).toEqual({ ok: false, codigo: "SIN_TOKEN" });
    expect(f).not.toHaveBeenCalled();
  });

  it("REAL: POST a /{igPageId}/messages con recipient y message, token de página, y devuelve el mid", async () => {
    const f = vi.fn(async () => json(200, { recipient_id: IGSID, message_id: "m_ABC" }));
    expect(await enviarTextoInstagram(REAL, IGSID, "hola Lucía", { fetch: f as never, leerToken: conToken })).toEqual({ ok: true, simulado: false, waMessageId: "m_ABC" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/1122334455/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer EAAP-token-pagina");
    expect(JSON.parse(init.body as string)).toEqual({ recipient: { id: IGSID }, message: { text: "hola Lucía" } });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("usa WHATSAPP_API_VERSION", async () => {
    vi.stubEnv("WHATSAPP_API_VERSION", "v23.0");
    const f = vi.fn(async () => json(200, { message_id: "m_1" }));
    await enviarTextoInstagram(REAL, IGSID, "x", { fetch: f as never, leerToken: conToken });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://graph.facebook.com/v23.0/1122334455/messages");
  });

  it("un texto largo sale en varias partes y devuelve el mid de la última", async () => {
    let n = 0;
    const f = vi.fn(async () => json(200, { message_id: `m_${++n}` }));
    const texto = "palabra ".repeat(300).trim(); // ~2.400 bytes
    const r = await enviarTextoInstagram(REAL, IGSID, texto, { fetch: f as never, leerToken: conToken });
    expect(f.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(r).toEqual({ ok: true, simulado: false, waMessageId: `m_${f.mock.calls.length}` });
    const enviados = (f.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => JSON.parse(init.body as string).message.text as string);
    expect(enviados.join("")).toBe(texto);
  });

  it("error de Meta: devuelve su code; si falla una parte posterior, falla todo", async () => {
    const f = vi.fn(async () => json(400, { error: { code: 10, message: "texto privado" } }));
    expect(await enviarTextoInstagram(REAL, IGSID, "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: false, codigo: "10" });

    let n = 0;
    const g = vi.fn(async () => (++n === 1 ? json(200, { message_id: "m_1" }) : json(400, { error: { code: 551 } })));
    expect(await enviarTextoInstagram(REAL, IGSID, "palabra ".repeat(300), { fetch: g as never, leerToken: conToken })).toEqual({ ok: false, codigo: "551" });
    expect(g).toHaveBeenCalledTimes(2);
  });

  it("HTTP sin cuerpo: el código es el HTTP; 200 sin mid: SIN_ID", async () => {
    expect(await enviarTextoInstagram(REAL, IGSID, "hola", { fetch: vi.fn(async () => new Response("<html>", { status: 502 })) as never, leerToken: conToken })).toEqual({ ok: false, codigo: "502" });
    expect(await enviarTextoInstagram(REAL, IGSID, "hola", { fetch: vi.fn(async () => json(200, {})) as never, leerToken: conToken })).toEqual({ ok: false, codigo: "SIN_ID" });
  });

  it("falla de red: RED, sin lanzar ni loguear el texto, el IGSID o el token", async () => {
    const consola = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "log")];
    const f = vi.fn(async () => { throw new Error("ECONNRESET"); });
    expect(await enviarTextoInstagram(REAL, IGSID, "hola", { fetch: f as never, leerToken: conToken })).toEqual({ ok: false, codigo: "RED" });
    for (const c of consola) expect(c).not.toHaveBeenCalled();
  });
});
