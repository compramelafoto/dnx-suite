import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/carpetas/subir-servidor", () => ({ subirBuffer: vi.fn() }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ leerTokenWhatsapp: vi.fn() }));

const { descargarMedio, descargarMedios } = await import("./medios");

type Fila = { id: string; workspaceId: string; chatId: string; tipo: string; media: unknown };

function base(fila: Fila | null, modo = "REAL") {
  const guardado: unknown[] = [];
  const db = {
    fotofficeWaMensaje: {
      findUnique: vi.fn(async () => fila),
      update: vi.fn(async ({ data }: { data: { media: unknown } }) => {
        guardado.push(data.media);
        return {};
      }),
    },
    fotofficeWaConexion: { findUnique: vi.fn(async () => ({ modo })) },
  };
  return { db, guardado };
}

const imagen = (): Fila => ({ id: "m1", workspaceId: "w1", chatId: "c1", tipo: "IMAGEN", media: { id: "meta-1", mimeType: "image/jpeg", caption: "esta" } });

function metaFalsa(opciones: { tamano?: number; estadoGraph?: number } = {}) {
  return vi.fn(async (url: string) => {
    if (url.includes("graph.facebook.com")) {
      if (opciones.estadoGraph) return new Response("{}", { status: opciones.estadoGraph });
      return Response.json({ url: "https://lookaside.fbsbx.com/secreta?x=1", mime_type: "image/jpeg", file_size: opciones.tamano ?? 3 });
    }
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  });
}

afterEach(() => vi.restoreAllMocks());

describe("bajar archivos de WhatsApp", () => {
  it("baja la imagen, la sube a R2 y guarda medidas sin perder el caption", async () => {
    const { db, guardado } = base(imagen());
    const fetch = metaFalsa();
    const subir = vi.fn(async () => undefined);
    const r = await descargarMedio("m1", { db: db as never, fetch, leerToken: async () => "tok", subir, medidas: async () => ({ ancho: 1600, alto: 1200 }) });
    expect(r).toBe("LISTO");
    expect(fetch.mock.calls[0][0]).toContain("/meta-1");
    expect(subir).toHaveBeenCalledWith("bandeja/w1/c1/m1.jpg", expect.any(Buffer), "image/jpeg");
    expect(guardado[0]).toMatchObject({ id: "meta-1", caption: "esta", descarga: "LISTO", clave: "bandeja/w1/c1/m1.jpg", bytes: 3, ancho: 1600, alto: 1200 });
  });

  it("cada pedido a Meta tiene tiempo máximo", async () => {
    const { db } = base(imagen());
    const fetch = metaFalsa();
    await descargarMedio("m1", { db: db as never, fetch, leerToken: async () => "tok", subir: async () => undefined, medidas: async () => null });
    for (const llamada of fetch.mock.calls as unknown as [string, RequestInit][]) expect(llamada[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("si ya se intentó, no vuelve a bajar", async () => {
    const fila = { ...imagen(), media: { id: "meta-1", descarga: "LISTO" } };
    const { db } = base(fila);
    const fetch = metaFalsa();
    expect(await descargarMedio("m1", { db: db as never, fetch, leerToken: async () => "tok" })).toBe("omitido");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("más de 100 MB → GRANDE y no sube", async () => {
    const { db, guardado } = base(imagen());
    const subir = vi.fn();
    const r = await descargarMedio("m1", { db: db as never, fetch: metaFalsa({ tamano: 200 * 1024 * 1024 }), leerToken: async () => "tok", subir });
    expect(r).toBe("GRANDE");
    expect(subir).not.toHaveBeenCalled();
    expect(guardado[0]).toMatchObject({ descarga: "GRANDE" });
  });

  it("sin token → FALLO guardado", async () => {
    const { db, guardado } = base(imagen());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await descargarMedio("m1", { db: db as never, fetch: metaFalsa(), leerToken: async () => null })).toBe("FALLO");
    expect(guardado[0]).toMatchObject({ descarga: "FALLO" });
  });

  it("Meta responde 401 → FALLO y el log no trae token ni URL", async () => {
    const { db } = base(imagen());
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await descargarMedio("m1", { db: db as never, fetch: metaFalsa({ estadoGraph: 401 }), leerToken: async () => "tok-secreto" })).toBe("FALLO");
    const escrito = JSON.stringify(log.mock.calls);
    expect(escrito).not.toContain("tok-secreto");
    expect(escrito).not.toContain("graph.facebook.com");
  });

  it("conexión simulada, mensaje sin id de Meta o inexistente → omitido", async () => {
    expect(await descargarMedio("m1", { db: base(imagen(), "SIMULADO").db as never, fetch: metaFalsa(), leerToken: async () => "tok" })).toBe("omitido");
    expect(await descargarMedio("m1", { db: base({ ...imagen(), media: { mimeType: "image/jpeg" } }).db as never, fetch: metaFalsa() })).toBe("omitido");
    expect(await descargarMedio("m1", { db: base(null).db as never, fetch: metaFalsa() })).toBe("omitido");
  });

  it("descargarMedios nunca lanza", async () => {
    const db = { fotofficeWaMensaje: { findUnique: vi.fn(async () => { throw new Error("base caída"); }) } };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(descargarMedios(["m1", "m2"], { db: db as never })).resolves.toBeUndefined();
  });
});

describe("bajar archivos de Instagram", () => {
  const foto = (url = "https://scontent-gru1-1.cdninstagram.com/v/t51/foto.jpg?sig=1"): Fila =>
    ({ id: "m2", workspaceId: "w1", chatId: "c9", tipo: "IMAGEN", media: { url } });
  const cdn = (opciones: { tipo?: string; largo?: number; estado?: number } = {}) =>
    vi.fn(async (_url: string, _init?: RequestInit) => new Response(new Uint8Array(opciones.largo ?? 4), {
      status: opciones.estado ?? 200,
      headers: { "content-type": opciones.tipo ?? "image/jpeg" },
    }));

  it("baja directo de la url, sin token ni Authorization, con la misma clave R2", async () => {
    const { db, guardado } = base(foto());
    const fetch = cdn();
    const leerToken = vi.fn(async () => "tok");
    const subir = vi.fn(async () => undefined);
    const r = await descargarMedio("m2", { db: db as never, fetch, leerToken, subir, medidas: async () => ({ ancho: 1080, alto: 1350 }) });
    expect(r).toBe("LISTO");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://scontent-gru1-1.cdninstagram.com/v/t51/foto.jpg?sig=1");
    expect(JSON.stringify(init?.headers ?? {})).not.toContain("Bearer");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(leerToken).not.toHaveBeenCalled();
    expect(subir).toHaveBeenCalledWith("bandeja/w1/c9/m2.jpg", expect.any(Buffer), "image/jpeg");
    expect(guardado[0]).toMatchObject({ descarga: "LISTO", clave: "bandeja/w1/c9/m2.jpg", bytes: 4, mimeType: "image/jpeg", ancho: 1080, alto: 1350 });
  });

  it("acepta fbcdn.net y lookaside.fbsbx.com; audio de Instagram (mp4) queda como .m4a", async () => {
    const subir = vi.fn(async () => undefined);
    expect(await descargarMedio("m2", { db: base(foto("https://video.xx.fbcdn.net/v/a.mp4")).db as never, fetch: cdn({ tipo: "video/mp4" }), subir })).toBe("LISTO");
    expect(await descargarMedio("m2", { db: base({ ...foto("https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1"), tipo: "AUDIO" }).db as never, fetch: cdn({ tipo: "audio/mp4" }), subir })).toBe("LISTO");
    expect(subir.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual(["bandeja/w1/c9/m2.mp4", "bandeja/w1/c9/m2.m4a"]);
  });

  it("una url que no es https o no es de Meta → FALLO sin pedirla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const url of ["http://scontent.cdninstagram.com/x.jpg", "https://evil.com/x.jpg", "https://cdninstagram.com.evil.com/x", "https://evilfbcdn.net/x", "no es url"]) {
      const { db, guardado } = base(foto(url));
      const fetch = cdn();
      expect(await descargarMedio("m2", { db: db as never, fetch })).toBe("FALLO");
      expect(fetch).not.toHaveBeenCalled();
      expect(guardado[0]).toMatchObject({ descarga: "FALLO" });
    }
  });

  it("más de 100 MB → GRANDE; error del CDN → FALLO sin loguear la url", async () => {
    const { db, guardado } = base(foto());
    const grande = vi.fn(async () => new Response(new Uint8Array(1), { status: 200, headers: { "content-length": String(200 * 1024 * 1024) } }));
    expect(await descargarMedio("m2", { db: db as never, fetch: grande, subir: vi.fn() })).toBe("GRANDE");
    expect(guardado[0]).toMatchObject({ descarga: "GRANDE" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await descargarMedio("m2", { db: base(foto()).db as never, fetch: cdn({ estado: 403 }) })).toBe("FALLO");
    expect(JSON.stringify(log.mock.calls)).not.toContain("cdninstagram");
  });
});
