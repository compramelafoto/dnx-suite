import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/imagenes/r2", () => ({ subirAR2: vi.fn() }));

import { ImagenInvalida } from "@/lib/imagenes/procesar";
import { verifyEntryImageSignature } from "./firma";
import { claveDeObraDeConcurso, copiarImagenDeConcurso, ImagenDeConcursoError, type DepsImagenDeConcurso } from "./imagen";

const SECRETO = "secreto-de-prueba";
const AHORA = new Date("2026-10-10T12:00:00Z");

function respuesta(cuerpo: Uint8Array<ArrayBuffer> | null, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(cuerpo, { status: init.status ?? 200, headers: init.headers });
}

function deps(over: Partial<DepsImagenDeConcurso> = {}) {
  const base = {
    fetch: vi.fn<DepsImagenDeConcurso["fetch"]>(async () => respuesta(new Uint8Array([1, 2, 3]))),
    now: () => AHORA,
    procesar: vi.fn<DepsImagenDeConcurso["procesar"]>(async () => ({ bytes: Buffer.from("webp"), width: 2000, height: 1333, contentType: "image/webp" as const })),
    subir: vi.fn<DepsImagenDeConcurso["subir"]>(async (_b: Buffer, clave: string) => `https://r2.test/${clave}`),
  };
  // Los reemplazos también son `vi.fn`: se tipan como los de la base para mirar sus llamadas.
  return Object.assign(base, over) as typeof base;
}

async function errorDe(p: Promise<unknown>): Promise<ImagenDeConcursoError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(ImagenDeConcursoError);
    return err as ImagenDeConcursoError;
  }
  throw new Error("no falló");
}

beforeEach(() => {
  vi.stubEnv("DNX_FOTORANK_LINK_SECRET", SECRETO);
  vi.stubEnv("FOTORANK_PUBLIC_BASE_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("clave de la obra en el bucket de Muestras", () => {
  it("fija por autor y obra", () => {
    expect(claveDeObraDeConcurso(7, "e1")).toBe("muestras/7/fr-e1.webp");
    expect(claveDeObraDeConcurso(null, "e1")).toBe("muestras/concursos/fr-e1.webp");
  });
  it("un id con barra o vacío no arma clave", () => {
    expect(() => claveDeObraDeConcurso(7, "../x")).toThrow(ImagenDeConcursoError);
    expect(() => claveDeObraDeConcurso(7, "")).toThrow(ImagenDeConcursoError);
  });
});

describe("copiar la imagen de FotoRank", () => {
  it("sin el secreto no sale ningún pedido", async () => {
    vi.stubEnv("DNX_FOTORANK_LINK_SECRET", "");
    const d = deps();
    const err = await errorDe(copiarImagenDeConcurso({ entryId: "e1", authorUserId: 7 }, d));
    expect(err.code).toBe("NOT_CONFIGURED");
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("pide el original firmado por 10 minutos, lo procesa como obra y lo sube con clave fija", async () => {
    const d = deps();
    const r = await copiarImagenDeConcurso({ entryId: "e1", authorUserId: 7 }, d);
    expect(r).toEqual({ url: "https://r2.test/muestras/7/fr-e1.webp", width: 2000, height: 1333 });

    const pedida = new URL(String((d.fetch.mock.calls[0] as unknown[])[0]));
    expect(pedida.origin + pedida.pathname).toBe("https://fotorank.dnxsuite.com/api/fotorank/external/entry-image");
    const exp = Number(pedida.searchParams.get("exp"));
    expect(exp).toBe(Math.floor(AHORA.getTime() / 1000) + 600);
    expect(pedida.searchParams.get("variant")).toBe("original");
    expect(pedida.searchParams.get("wm")).toBe("");
    const firma = {
      entryId: pedida.searchParams.get("entryId") ?? "",
      variant: pedida.searchParams.get("variant") ?? "",
      exp,
      wm: pedida.searchParams.get("wm"),
      sig: pedida.searchParams.get("sig") ?? "",
    };
    expect(verifyEntryImageSignature(firma, SECRETO, AHORA)).toEqual({ ok: true });

    expect(d.procesar).toHaveBeenCalledWith(Buffer.from([1, 2, 3]), "obra");
    expect(d.subir).toHaveBeenCalledWith(Buffer.from("webp"), "muestras/7/fr-e1.webp", "image/webp");
  });

  it("usa la base de FotoRank configurada", async () => {
    vi.stubEnv("FOTORANK_PUBLIC_BASE_URL", "https://fr.test/");
    const d = deps();
    await copiarImagenDeConcurso({ entryId: "e1", authorUserId: 7 }, d);
    expect(String((d.fetch.mock.calls[0] as unknown[])[0])).toMatch(/^https:\/\/fr\.test\/api\/fotorank\/external\/entry-image\?/);
  });

  it("FotoRank no la da → FETCH_FAILED, sin procesar y sin la URL firmada en el log", async () => {
    const d = deps({ fetch: vi.fn(async () => respuesta(null, { status: 404 })) });
    const err = await errorDe(copiarImagenDeConcurso({ entryId: "e1", authorUserId: 7 }, d));
    expect(err.code).toBe("FETCH_FAILED");
    expect(d.procesar).not.toHaveBeenCalled();
    const log = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(log).not.toContain("sig=");
  });

  it("de más de 30 MB por content-length → FETCH_FAILED sin leer ni procesar", async () => {
    const d = deps({ fetch: vi.fn(async () => respuesta(new Uint8Array([1]), { headers: { "content-length": String(31 * 1024 * 1024) } })) });
    expect((await errorDe(copiarImagenDeConcurso({ entryId: "e1", authorUserId: 7 }, d))).code).toBe("FETCH_FAILED");
    expect(d.procesar).not.toHaveBeenCalled();
  });

  it("de más de 30 MB al leerla → FETCH_FAILED", async () => {
    const grande = new Uint8Array(30 * 1024 * 1024 + 1);
    const d = deps({ fetch: vi.fn(async () => respuesta(grande)) });
    expect((await errorDe(copiarImagenDeConcurso({ entryId: "e1", authorUserId: 7 }, d))).code).toBe("FETCH_FAILED");
    expect(d.procesar).not.toHaveBeenCalled();
  });

  it("vacía → FETCH_FAILED", async () => {
    const d = deps({ fetch: vi.fn(async () => respuesta(new Uint8Array())) });
    expect((await errorDe(copiarImagenDeConcurso({ entryId: "e1", authorUserId: 7 }, d))).code).toBe("FETCH_FAILED");
  });

  it("la red falla → FETCH_FAILED, sin repetir la URL firmada que traiga el error", async () => {
    const d = deps({ fetch: vi.fn(async (u: unknown) => { throw new TypeError(`fetch failed: ${String(u)}`); }) });
    expect((await errorDe(copiarImagenDeConcurso({ entryId: "e1", authorUserId: 7 }, d))).code).toBe("FETCH_FAILED");
    const log = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(log).not.toContain("sig=");
  });

  it("imagen inválida → INVALID con su motivo, sin subir", async () => {
    const d = deps({ procesar: vi.fn(async () => { throw new ImagenInvalida("La imagen tiene demasiados píxeles (máximo 50 megapíxeles)."); }) });
    const err = await errorDe(copiarImagenDeConcurso({ entryId: "e1", authorUserId: 7 }, d));
    expect(err.code).toBe("INVALID");
    expect(err.message).toBe("La imagen tiene demasiados píxeles (máximo 50 megapíxeles).");
    expect(d.subir).not.toHaveBeenCalled();
  });

  it("un id de obra con barra se rechaza antes de pedir", async () => {
    const d = deps();
    const err = await errorDe(copiarImagenDeConcurso({ entryId: "a/b", authorUserId: 7 }, d));
    expect(err.code).toBe("INVALID");
    expect(d.fetch).not.toHaveBeenCalled();
  });
});
