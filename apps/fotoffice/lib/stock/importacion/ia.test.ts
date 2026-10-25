import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  gastoDelMes: vi.fn(),
  registrarUsoImportacion: vi.fn(),
  sharpArgs: [] as unknown[],
  rotate: vi.fn(),
  resize: vi.fn(),
  jpeg: vi.fn(),
  toBuffer: vi.fn(),
  constructor: vi.fn(),
}));

vi.mock("@/lib/dnx-bot/store", () => ({
  gastoDelMes: m.gastoDelMes,
  registrarUsoImportacion: m.registrarUsoImportacion,
}));

vi.mock("sharp", () => {
  const cadena = { rotate: m.rotate, resize: m.resize, jpeg: m.jpeg, toBuffer: m.toBuffer };
  m.rotate.mockReturnValue(cadena);
  m.resize.mockReturnValue(cadena);
  m.jpeg.mockReturnValue(cadena);
  const sharp = (...args: unknown[]) => {
    m.sharpArgs.push(args);
    return cadena;
  };
  return { default: sharp };
});

vi.mock("@repo/dnx-bot", async (orig) => {
  const real = await orig<typeof import("@repo/dnx-bot")>();
  class AnthropicFalso {
    constructor(opts: unknown) {
      m.constructor(opts);
    }
  }
  return { ...real, Anthropic: AnthropicFalso };
});

import { costMicroUsd } from "@repo/dnx-bot";
import { SCHEMA_FACTURA } from "./esquema";
import { SYSTEM_PROMPT, iaDisponible, leerConIa, prepararEntrada } from "./ia";

const DOC = {
  proveedor: "Kodak Argentina",
  cuit: "30-12345678-9",
  fecha: "2026-10-20",
  comprobante: "A 0001-00001234",
  precios_con_iva: false,
  total: 240000,
  filas: [
    {
      codigo_barras: "7790000000001",
      codigo_proveedor: "K305",
      descripcion: "Kit Kodak 305 6R",
      cantidad: 2,
      unidad: "kit",
      unidades_por_paquete: 640,
      costo_unitario: 120000,
      alicuota_iva: 21,
      subtotal: 240000,
    },
  ],
};

const USAGE = { input_tokens: 3000, output_tokens: 800, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

function respuesta(over: Record<string, unknown> = {}) {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(DOC) }],
    usage: USAGE,
    ...over,
  };
}

function clienteFalso(r: unknown = respuesta()) {
  const create = vi.fn().mockResolvedValue(r);
  return { create, cliente: { beta: { messages: { create } } } as never };
}

const BLOQUES_TEXTO = [{ type: "text" as const, text: "Factura de prueba" }];

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
  vi.stubEnv("FOTOFFICE_STOCK_IMPORT_MODEL", "");
  vi.stubEnv("FOTOFFICE_BOT_MODEL", "");
  vi.stubEnv("FOTOFFICE_BOT_MONTHLY_CAP_USD", "15");
  vi.stubEnv("FOTOFFICE_BOT_WORKSPACE_MONTHLY_CAP_USD", "10");
  m.gastoDelMes.mockReset().mockResolvedValue(0);
  m.registrarUsoImportacion.mockReset().mockResolvedValue(undefined);
  m.sharpArgs.length = 0;
  m.rotate.mockClear();
  m.resize.mockClear();
  m.jpeg.mockClear();
  m.toBuffer.mockReset().mockResolvedValue(Buffer.from("jpeg-chico"));
  m.constructor.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("iaDisponible", () => {
  it("depende de que haya clave de Anthropic", () => {
    expect(iaDisponible()).toBe(true);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(iaDisponible()).toBe(false);
  });
});

describe("leerConIa: la llamada", () => {
  it("arma la llamada exacta: modelo de config, 16000 tokens, fallback del servidor, effort medium y JSON schema", async () => {
    const { create, cliente } = clienteFalso();
    const r = await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente });
    expect(r).toEqual({ ok: true, doc: DOC });
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0]![0];
    expect(params).toEqual({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA_FACTURA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: BLOQUES_TEXTO }],
    });
    expect(params).not.toHaveProperty("thinking");
    expect(params).not.toHaveProperty("temperature");
  });

  it("el modelo sale de FOTOFFICE_STOCK_IMPORT_MODEL si está, y si no del bot", async () => {
    vi.stubEnv("FOTOFFICE_STOCK_IMPORT_MODEL", "  claude-opus-5-5 ");
    const a = clienteFalso();
    await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente: a.cliente });
    expect(a.create.mock.calls[0]![0].model).toBe("claude-opus-5-5");

    vi.stubEnv("FOTOFFICE_STOCK_IMPORT_MODEL", "");
    vi.stubEnv("FOTOFFICE_BOT_MODEL", "claude-haiku-5");
    const b = clienteFalso();
    await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente: b.cliente });
    expect(b.create.mock.calls[0]![0].model).toBe("claude-haiku-5");
  });

  it("sin cliente inyectado crea el de Anthropic con la clave, 1 reintento y 120 s", async () => {
    // El falso no tiene `beta`: la llamada falla y se informa como error, pero el constructor quedó registrado.
    const r = await leerConIa("ws1", 7, BLOQUES_TEXTO);
    expect(m.constructor).toHaveBeenCalledWith({ apiKey: "sk-test", maxRetries: 1, timeout: 120_000 });
    expect(r.ok).toBe(false);
  });

  it("el system prompt pide una fila por artículo, no inventar y leer números argentinos", () => {
    expect(SYSTEM_PROMPT).toMatch(/una fila por artículo/i);
    expect(SYSTEM_PROMPT).toMatch(/null/);
    expect(SYSTEM_PROMPT).toMatch(/unidades_por_paquete/);
    expect(SYSTEM_PROMPT).toMatch(/precios_con_iva/);
    expect(SYSTEM_PROMPT).toContain("1.234,50");
    expect(SYSTEM_PROMPT).toContain("1234.5");
  });

  it("el system prompt explica los paquetes y las pistas de IVA, subtotal y comprobante", () => {
    expect(SYSTEM_PROMPT).toContain("640 copias c/u");
    expect(SYSTEM_PROMPT).toMatch(/cantidad" = número de paquetes/);
    expect(SYSTEM_PROMPT).toMatch(/precio de cada paquete/);
    expect(SYSTEM_PROMPT).toContain("21, 10.5 o 27");
    expect(SYSTEM_PROMPT).toContain("A 0001-00001234");
    expect(SYSTEM_PROMPT).toMatch(/bonificaciones/i);
  });
});

describe("leerConIa: la respuesta", () => {
  it("refusal ⇒ mensaje para probar con otra foto", async () => {
    const { cliente } = clienteFalso(respuesta({ stop_reason: "refusal", content: [] }));
    expect(await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente })).toEqual({
      ok: false,
      error: "No pudimos leer este archivo. Probá con otra foto o cargalo a mano.",
    });
  });

  it("max_tokens ⇒ la factura es muy larga", async () => {
    const { cliente } = clienteFalso(respuesta({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"proveedor":' }] }));
    expect(await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente })).toEqual({
      ok: false,
      error: "La factura es muy larga: dividila o usá la plantilla CSV.",
    });
  });

  it("JSON roto o que no cumple el esquema ⇒ lectura incompleta", async () => {
    const incompleta = { ok: false, error: "La lectura salió incompleta. Probá de nuevo o usá la plantilla CSV." };
    const roto = clienteFalso(respuesta({ content: [{ type: "text", text: "no es json" }] }));
    expect(await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente: roto.cliente })).toEqual(incompleta);
    const malo = clienteFalso(respuesta({ content: [{ type: "text", text: JSON.stringify({ ...DOC, filas: "x" }) }] }));
    expect(await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente: malo.cliente })).toEqual(incompleta);
    const vacio = clienteFalso(respuesta({ content: [] }));
    expect(await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente: vacio.cliente })).toEqual(incompleta);
  });

  it("toma el primer bloque de texto aunque venga otro antes", async () => {
    const { cliente } = clienteFalso(
      respuesta({ content: [{ type: "thinking", thinking: "...", signature: "s" }, { type: "text", text: JSON.stringify(DOC) }] }),
    );
    expect(await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente })).toEqual({ ok: true, doc: DOC });
  });

  it("si la API falla, devuelve un error y no revienta", async () => {
    const create = vi.fn().mockRejectedValue(new Error("529 overloaded"));
    const r = await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente: { beta: { messages: { create } } } as never });
    expect(r.ok).toBe(false);
    expect(m.registrarUsoImportacion).not.toHaveBeenCalled();
  });
});

describe("leerConIa: clave y gasto", () => {
  it("sin clave no llama y avisa que no está configurada", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { create, cliente } = clienteFalso();
    expect(await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente })).toEqual({
      ok: false,
      error: "La lectura con IA no está configurada.",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("tope del workspace alcanzado ⇒ no llama", async () => {
    const ahora = new Date("2026-10-21T15:00:00Z");
    m.gastoDelMes.mockImplementation(async (p: { plataforma?: string }) => (p.plataforma ? 10_000_000 : 0));
    const { create, cliente } = clienteFalso();
    expect(await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente, ahora })).toEqual({
      ok: false,
      error: "Se alcanzó el tope de gasto de IA de este mes. Usá la plantilla CSV.",
    });
    expect(create).not.toHaveBeenCalled();
    expect(m.gastoDelMes).toHaveBeenCalledWith({ plataforma: "FOTOFFICE:ws1", ahora });
    expect(m.gastoDelMes).toHaveBeenCalledWith({ ahora });
  });

  it("tope global alcanzado ⇒ no llama", async () => {
    m.gastoDelMes.mockImplementation(async (p: { plataforma?: string }) => (p.plataforma ? 0 : 15_000_000));
    const { create, cliente } = clienteFalso();
    const r = await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente });
    expect(r).toEqual({ ok: false, error: "Se alcanzó el tope de gasto de IA de este mes. Usá la plantilla CSV." });
    expect(create).not.toHaveBeenCalled();
  });

  it("tope en 0 = sin tope", async () => {
    vi.stubEnv("FOTOFFICE_BOT_MONTHLY_CAP_USD", "0");
    vi.stubEnv("FOTOFFICE_BOT_WORKSPACE_MONTHLY_CAP_USD", "0");
    m.gastoDelMes.mockResolvedValue(999_000_000);
    const { create, cliente } = clienteFalso();
    expect((await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente })).ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("registra el uso con costMicroUsd del modelo que respondió, aunque la respuesta sea un rechazo", async () => {
    const ok = clienteFalso();
    await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente: ok.cliente });
    expect(m.registrarUsoImportacion).toHaveBeenCalledWith({
      plataforma: "FOTOFFICE:ws1",
      userId: 7,
      usage: USAGE,
      costMicroUsd: costMicroUsd("claude-sonnet-5-5", USAGE),
    });

    m.registrarUsoImportacion.mockClear();
    const rechazo = clienteFalso(respuesta({ stop_reason: "refusal", content: [] }));
    await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente: rechazo.cliente });
    expect(m.registrarUsoImportacion).toHaveBeenCalledTimes(1);
  });

  it("si registrar el uso falla, la lectura igual sale", async () => {
    m.registrarUsoImportacion.mockRejectedValue(new Error("db caída"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cliente } = clienteFalso();
    expect(await leerConIa("ws1", 7, BLOQUES_TEXTO, { cliente })).toEqual({ ok: true, doc: DOC });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("prepararEntrada", () => {
  const archivo = (tipo: string, bytes = Buffer.from("x"), nombre = "factura") => ({ nombre, tipo, bytes });

  it("imagen: pasa por sharp con rotate, ≤ 2000 px y JPEG 85; va antes del texto", async () => {
    const r = await prepararEntrada(archivo("image/png", Buffer.from("png-original"), "f.png"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(m.sharpArgs[0]).toEqual([Buffer.from("png-original"), expect.anything()]);
    expect(m.rotate).toHaveBeenCalledWith();
    expect(m.resize).toHaveBeenCalledWith({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
    expect(m.jpeg).toHaveBeenCalledWith({ quality: 85 });
    expect(r.bloques[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: Buffer.from("jpeg-chico").toString("base64") },
    });
    expect(r.bloques[1]).toMatchObject({ type: "text" });
    expect(r.bloques).toHaveLength(2);
  });

  it("acepta JPG, WEBP, HEIC y HEIF (también por extensión si el tipo viene vacío)", async () => {
    for (const t of ["image/jpeg", "image/webp", "image/heic", "image/heif"]) {
      expect((await prepararEntrada(archivo(t))).ok).toBe(true);
    }
    expect((await prepararEntrada(archivo("", Buffer.from("x"), "IMG_0001.HEIC"))).ok).toBe(true);
    expect((await prepararEntrada(archivo("application/octet-stream", Buffer.from("x"), "foto.jpg"))).ok).toBe(true);
  });

  it("imagen que sharp no puede abrir ⇒ error claro", async () => {
    m.toBuffer.mockRejectedValue(new Error("unsupported image format"));
    const r = await prepararEntrada(archivo("image/heic"));
    expect(r).toEqual({ ok: false, error: "No pudimos abrir esa imagen. Probá sacarle una captura o exportarla como JPG." });
  });

  it("PDF: bloque document en base64 antes del texto, sin pasar por sharp", async () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n");
    const r = await prepararEntrada(archivo("application/pdf", pdf, "f.pdf"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bloques[0]).toEqual({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
    });
    expect(r.bloques[1]).toMatchObject({ type: "text" });
    expect(m.sharpArgs).toHaveLength(0);
  });

  it("PDF de más de 20 páginas ⇒ rechazado", async () => {
    const paginas = Array.from({ length: 21 }, (_, i) => `${i + 1} 0 obj << /Type /Page /Parent 99 0 R >> endobj`).join("\n");
    const pdf = Buffer.from(`%PDF-1.4\n99 0 obj << /Type /Pages /Count 21 >> endobj\n${paginas}`);
    const r = await prepararEntrada(archivo("application/pdf", pdf));
    expect(r).toEqual({ ok: false, error: "El PDF tiene más de 20 páginas: dividilo o usá la plantilla CSV." });
  });

  it("más de 10 MB ⇒ rechazado", async () => {
    const r = await prepararEntrada(archivo("image/jpeg", Buffer.alloc(10 * 1024 * 1024 + 1)));
    expect(r).toEqual({ ok: false, error: "El archivo pesa más de 10 MB." });
    expect(m.sharpArgs).toHaveLength(0);
  });

  it("tipo no soportado ⇒ rechazado", async () => {
    for (const a of [archivo("text/plain", Buffer.from("x"), "f.txt"), archivo("image/gif", Buffer.from("x"), "f.gif"), archivo("", Buffer.from("x"), "f")]) {
      expect(await prepararEntrada(a)).toEqual({
        ok: false,
        error: "Ese tipo de archivo no se puede leer: usá JPG, PNG, HEIC o PDF.",
      });
    }
  });

  it("texto pegado: bloque text con el contenido; hasta 20 000 caracteres", async () => {
    const r = await prepararEntrada({ texto: "  Kit Kodak 305 x2 $120.000  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bloques).toHaveLength(1);
    expect(r.bloques[0]).toMatchObject({ type: "text" });
    expect((r.bloques[0] as { text: string }).text).toContain("Kit Kodak 305 x2 $120.000");
    expect((await prepararEntrada({ texto: "a".repeat(20000) })).ok).toBe(true);
  });

  it("texto de más de 20 000 caracteres o vacío ⇒ rechazado", async () => {
    expect(await prepararEntrada({ texto: "a".repeat(20001) })).toEqual({
      ok: false,
      error: "El texto pegado supera los 20 000 caracteres: dividilo o usá la plantilla CSV.",
    });
    expect(await prepararEntrada({ texto: "   " })).toEqual({ ok: false, error: "Pegá el texto de la factura." });
  });
});
