import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/imagenes/r2", () => ({ subirAR2: vi.fn(), borrarDeR2: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: {} }));

import { ImagenInvalida } from "@/lib/imagenes/procesar";
import { verifyEntryImageSignature } from "./firma";
import { borrarImagenDeConcurso, claveDeObraDeConcurso, copiarImagenDeConcurso, ImagenDeConcursoError, type DepsImagenDeConcurso } from "./imagen";

const SECRETO = "secreto-de-prueba";
const AHORA = new Date("2026-10-10T12:00:00Z");
const OBRA = { entryId: "e1", authorUserId: 7, include: true, imageStatus: "PENDING", imageUrl: null, exhibitConsent: "ACCEPTED" };
const CLAVE = claveDeObraDeConcurso(7, "e1", SECRETO);

function respuesta(cuerpo: Uint8Array<ArrayBuffer> | null, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(cuerpo, { status: init.status ?? 200, headers: init.headers });
}

function deps(over: Partial<DepsImagenDeConcurso> = {}) {
  const base = {
    fetch: vi.fn<DepsImagenDeConcurso["fetch"]>(async () => respuesta(new Uint8Array([1, 2, 3]))),
    now: () => AHORA,
    procesar: vi.fn<DepsImagenDeConcurso["procesar"]>(async () => ({ bytes: Buffer.from("webp"), width: 2000, height: 1333, contentType: "image/webp" as const })),
    subir: vi.fn<DepsImagenDeConcurso["subir"]>(async (_b: Buffer, clave: string) => `https://r2.test/${clave}`),
    leerObra: vi.fn<DepsImagenDeConcurso["leerObra"]>(async () => ({ ...OBRA })),
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
  it("fija por autor y obra, con una huella que no se adivina sin el secreto", () => {
    expect(claveDeObraDeConcurso(7, "e1", SECRETO)).toMatch(/^muestras\/7\/fr-e1-[A-Za-z0-9_-]{22}\.webp$/);
    expect(claveDeObraDeConcurso(7, "e1", SECRETO)).toBe(claveDeObraDeConcurso(7, "e1", SECRETO));
    expect(claveDeObraDeConcurso(null, "e1", SECRETO)).toMatch(/^muestras\/concursos\/fr-e1-[A-Za-z0-9_-]{22}\.webp$/);
    expect(claveDeObraDeConcurso(7, "e1", "otro")).not.toBe(claveDeObraDeConcurso(7, "e1", SECRETO));
    expect(claveDeObraDeConcurso(7, "e2", SECRETO)).not.toBe(claveDeObraDeConcurso(7, "e1", SECRETO).replace("e1", "e2"));
  });
  it("un id con barra o vacío, o sin secreto, no arma clave", () => {
    expect(() => claveDeObraDeConcurso(7, "../x", SECRETO)).toThrow(ImagenDeConcursoError);
    expect(() => claveDeObraDeConcurso(7, "", SECRETO)).toThrow(ImagenDeConcursoError);
    expect(() => claveDeObraDeConcurso(7, "e1", "")).toThrow(ImagenDeConcursoError);
  });
});

describe("copiar la imagen de FotoRank", () => {
  it("sin el secreto no sale ningún pedido", async () => {
    vi.stubEnv("DNX_FOTORANK_LINK_SECRET", "");
    const d = deps();
    const err = await errorDe(copiarImagenDeConcurso("cw1", d));
    expect(err.code).toBe("NOT_CONFIGURED");
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("pide el original firmado por 10 minutos, lo procesa como obra y lo sube con clave fija", async () => {
    const d = deps();
    const r = await copiarImagenDeConcurso("cw1", d);
    expect(r).toEqual({ url: `https://r2.test/${CLAVE}`, width: 2000, height: 1333 });
    expect(d.leerObra).toHaveBeenCalledWith("cw1");

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
    expect(d.subir).toHaveBeenCalledWith(Buffer.from("webp"), CLAVE, "image/webp");
  });

  it("usa la base de FotoRank configurada", async () => {
    vi.stubEnv("FOTORANK_PUBLIC_BASE_URL", "https://fr.test/");
    const d = deps();
    await copiarImagenDeConcurso("cw1", d);
    expect(String((d.fetch.mock.calls[0] as unknown[])[0])).toMatch(/^https:\/\/fr\.test\/api\/fotorank\/external\/entry-image\?/);
  });

  it("FotoRank no la da → FETCH_FAILED, sin procesar y sin la URL firmada en el log", async () => {
    const d = deps({ fetch: vi.fn(async () => respuesta(null, { status: 404 })) });
    const err = await errorDe(copiarImagenDeConcurso("cw1", d));
    expect(err.code).toBe("FETCH_FAILED");
    expect(d.procesar).not.toHaveBeenCalled();
    const log = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(log).not.toContain("sig=");
  });

  it("de más de 30 MB por content-length → FETCH_FAILED sin leer ni procesar", async () => {
    const d = deps({ fetch: vi.fn(async () => respuesta(new Uint8Array([1]), { headers: { "content-length": String(31 * 1024 * 1024) } })) });
    expect((await errorDe(copiarImagenDeConcurso("cw1", d))).code).toBe("FETCH_FAILED");
    expect(d.procesar).not.toHaveBeenCalled();
  });

  it("de más de 30 MB al leerla → FETCH_FAILED", async () => {
    const grande = new Uint8Array(30 * 1024 * 1024 + 1);
    const d = deps({ fetch: vi.fn(async () => respuesta(grande)) });
    expect((await errorDe(copiarImagenDeConcurso("cw1", d))).code).toBe("FETCH_FAILED");
    expect(d.procesar).not.toHaveBeenCalled();
  });

  it("vacía → FETCH_FAILED", async () => {
    const d = deps({ fetch: vi.fn(async () => respuesta(new Uint8Array())) });
    expect((await errorDe(copiarImagenDeConcurso("cw1", d))).code).toBe("FETCH_FAILED");
  });

  it("la red falla → FETCH_FAILED, sin repetir la URL firmada que traiga el error", async () => {
    const d = deps({ fetch: vi.fn(async (u: unknown) => { throw new TypeError(`fetch failed: ${String(u)}`); }) });
    expect((await errorDe(copiarImagenDeConcurso("cw1", d))).code).toBe("FETCH_FAILED");
    const log = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(log).not.toContain("sig=");
  });

  it("imagen inválida → INVALID con su motivo, sin subir", async () => {
    const d = deps({ procesar: vi.fn(async () => { throw new ImagenInvalida("La imagen tiene demasiados píxeles (máximo 50 megapíxeles)."); }) });
    const err = await errorDe(copiarImagenDeConcurso("cw1", d));
    expect(err.code).toBe("INVALID");
    expect(err.message).toBe("La imagen tiene demasiados píxeles (máximo 50 megapíxeles).");
    expect(d.subir).not.toHaveBeenCalled();
  });

  it("un id de obra con barra se rechaza antes de pedir", async () => {
    const d = deps({ leerObra: vi.fn(async () => ({ ...OBRA, entryId: "a/b" })) });
    const err = await errorDe(copiarImagenDeConcurso("cw1", d));
    expect(err.code).toBe("INVALID");
    expect(d.fetch).not.toHaveBeenCalled();
  });
  it("sólo obras leídas de la base: un id que no está o raro no pide nada", async () => {
    const d = deps({ leerObra: vi.fn(async () => null) });
    expect((await errorDe(copiarImagenDeConcurso("cw1", d))).code).toBe("INVALID");
    expect((await errorDe(copiarImagenDeConcurso("../x", d))).code).toBe("INVALID");
    expect(d.fetch).not.toHaveBeenCalled();
  });
  it("antes del permiso del autor, o sacada de la muestra, la imagen no sale de FotoRank", async () => {
    for (const cambio of [{ exhibitConsent: "PENDING" }, { exhibitConsent: "DECLINED" }, { exhibitConsent: "WITHDRAWN" }, { include: false }]) {
      const d = deps({ leerObra: vi.fn(async () => ({ ...OBRA, ...cambio })) });
      expect((await errorDe(copiarImagenDeConcurso("cw1", d))).code).toBe("NOT_ALLOWED");
      expect(d.fetch).not.toHaveBeenCalled();
    }
  });
});

describe("borrar la copia", () => {
  it("borra sólo copias de concursos, a mejor esfuerzo", async () => {
    const borrar = vi.fn(async () => {});
    await borrarImagenDeConcurso(`https://r2.test/${CLAVE}`, borrar);
    expect(borrar).toHaveBeenCalledWith(`https://r2.test/${CLAVE}`);
    borrar.mockClear();
    await borrarImagenDeConcurso("https://r2.test/muestras/7/obra-subida.webp", borrar);
    await borrarImagenDeConcurso(null, borrar);
    expect(borrar).not.toHaveBeenCalled();
  });
  it("si falla, lo registra y sigue", async () => {
    const borrar = vi.fn(async () => { throw new Error("R2 caído"); });
    await expect(borrarImagenDeConcurso(`https://r2.test/${CLAVE}`, borrar)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
