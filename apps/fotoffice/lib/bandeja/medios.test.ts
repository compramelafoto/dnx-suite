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
