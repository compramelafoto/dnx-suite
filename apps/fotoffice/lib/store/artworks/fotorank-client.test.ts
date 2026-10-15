import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ArtworkImageError,
  buildOriginalUrl,
  buildPreviewUrl,
  fetchPreview,
  storePreviewInR2,
} from "./fotorank-client";
import { verifyEntryImageSignature } from "./signing";

const SECRET = "secreto-compartido-de-prueba";
const AHORA = new Date("2026-10-05T12:00:00Z");

function params(url: string) {
  const u = new URL(url);
  const q = u.searchParams;
  return {
    origin: u.origin,
    path: u.pathname,
    entryId: q.get("entryId") ?? "",
    variant: q.get("variant") ?? "",
    exp: Number(q.get("exp")),
    wm: q.get("wm"),
    sig: q.get("sig") ?? "",
  };
}

beforeEach(() => {
  vi.stubEnv("DNX_FOTORANK_LINK_SECRET", SECRET);
  vi.stubEnv("FOTORANK_PUBLIC_BASE_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("enlaces firmados a FotoRank", () => {
  it("preview: firmado, 10 minutos, con la marca de agua, contra el dominio canónico por omisión", () => {
    const url = buildPreviewUrl("entry-1", "Muestra · SFPR", { now: AHORA });
    const p = params(url);
    expect(p.origin).toBe("https://fotorank.dnxsuite.com");
    expect(p.path).toBe("/api/fotorank/external/entry-image");
    expect(p.variant).toBe("preview");
    expect(p.wm).toBe("Muestra · SFPR");
    expect(p.exp).toBe(AHORA.getTime() / 1000 + 600);
    expect(verifyEntryImageSignature(p, SECRET, AHORA)).toEqual({ ok: true });
    expect(verifyEntryImageSignature(p, SECRET, new Date(AHORA.getTime() + 601_000))).toEqual({
      ok: false,
      reason: "EXPIRED",
    });
  });

  it("original: sin marca de agua y con la base configurada", () => {
    vi.stubEnv("FOTORANK_PUBLIC_BASE_URL", "https://fotorank.example/");
    const p = params(buildOriginalUrl("entry-1", { now: AHORA }));
    expect(p.origin).toBe("https://fotorank.example");
    expect(p.variant).toBe("original");
    expect(p.wm).toBe("");
    expect(verifyEntryImageSignature(p, SECRET, AHORA)).toEqual({ ok: true });
  });

  it("un «|» en la marca de agua se cambia por un guion en vez de romper la firma", () => {
    const p = params(buildPreviewUrl("entry-1", "Foto | Club", { now: AHORA }));
    expect(p.wm).toBe("Foto - Club");
    expect(verifyEntryImageSignature(p, SECRET, AHORA)).toEqual({ ok: true });
  });

  it("marca vacía o sin caracteres dibujables, o entryId con «|»: BAD_PARAMS tipado", () => {
    for (const wm of ["", "   ", "\u200B", "\u{1F600}"]) {
      expect(() => buildPreviewUrl("entry-1", wm)).toThrow(expect.objectContaining({ code: "BAD_PARAMS" }));
    }
    expect(() => buildOriginalUrl("a|b")).toThrow(expect.objectContaining({ code: "BAD_PARAMS" }));
    expect(() => buildPreviewUrl("a|b", "Muestra")).toThrow(ArtworkImageError);
  });

  it("sin secreto: ARTWORKS_NOT_CONFIGURED", () => {
    vi.stubEnv("DNX_FOTORANK_LINK_SECRET", "");
    expect(() => buildPreviewUrl("e", "x")).toThrow(ArtworkImageError);
    try {
      buildOriginalUrl("e");
    } catch (e) {
      expect((e as ArtworkImageError).code).toBe("ARTWORKS_NOT_CONFIGURED");
    }
  });
});

describe("fetchPreview", () => {
  it("devuelve los bytes de la respuesta", async () => {
    const llamadas: string[] = [];
    const fetchFalso = vi.fn(async (url: string | URL | Request) => {
      llamadas.push(String(url));
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg; charset=binary" },
      });
    });
    const buf = await fetchPreview("entry-1", "Muestra", { fetch: fetchFalso as unknown as typeof fetch, now: AHORA });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect([...buf]).toEqual([1, 2, 3]);
    expect(params(llamadas[0]!).variant).toBe("preview");
  });

  it("404, otro tipo, demasiado grande, cuerpo vacío o error de red: FETCH_FAILED", async () => {
    const jpeg = { "Content-Type": "image/jpeg" };
    const casos = [
      async () => new Response("Not found", { status: 404 }),
      async () => new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } }),
      async () => new Response(new Uint8Array([1]), { status: 200, headers: { ...jpeg, "Content-Length": String(11 * 1024 * 1024) } }),
      async () => new Response(new Uint8Array(10 * 1024 * 1024 + 1), { status: 200, headers: jpeg }),
      async () => new Response(new Uint8Array([]), { status: 200, headers: jpeg }),
      async () => {
        throw new Error("red caída");
      },
    ];
    for (const f of casos) {
      await expect(fetchPreview("e", "x", { fetch: f as unknown as typeof fetch })).rejects.toMatchObject({
        code: "FETCH_FAILED",
      });
    }
  });

  it("corta a los 15 segundos", async () => {
    vi.useFakeTimers();
    try {
      const colgado = (_u: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("abortado")));
        });
      const p = fetchPreview("e", "x", { fetch: colgado as unknown as typeof fetch });
      const expectativa = expect(p).rejects.toMatchObject({ code: "FETCH_FAILED" });
      await vi.advanceTimersByTimeAsync(15_000);
      await expectativa;
    } finally {
      vi.useRealTimers();
    }
  });

  it("sin secreto no sale a la red", async () => {
    vi.stubEnv("DNX_FOTORANK_LINK_SECRET", "");
    const f = vi.fn();
    await expect(fetchPreview("e", "x", { fetch: f as unknown as typeof fetch })).rejects.toMatchObject({
      code: "ARTWORKS_NOT_CONFIGURED",
    });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("storePreviewInR2", () => {
  it("sube el JPEG bajo fotoffice/artwork-previews/<workspace>/<listing>/ y devuelve medidas", async () => {
    const jpeg = await sharp({ create: { width: 320, height: 200, channels: 3, background: "#888" } }).jpeg().toBuffer();
    const subidas: { key: string; contentType: string; size: number }[] = [];
    const r = await storePreviewInR2("ws_1", "listing_1", jpeg, {
      upload: async (buffer, key, contentType) => {
        subidas.push({ key, contentType, size: buffer.length });
        return { key, url: `https://media.example/${key}` };
      },
    });
    expect(subidas).toHaveLength(1);
    expect(subidas[0]!.key).toMatch(/^fotoffice\/artwork-previews\/ws_1\/listing_1\/[0-9a-f-]{36}\.jpg$/);
    expect(subidas[0]!.contentType).toBe("image/jpeg");
    expect(r).toEqual({ url: `https://media.example/${subidas[0]!.key}`, width: 320, height: 200 });
  });

  it("rechaza ids que escapan del prefijo y bytes que no son imagen", async () => {
    const upload = vi.fn();
    const jpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#888" } }).jpeg().toBuffer();
    await expect(storePreviewInR2("../x", "l", jpeg, { upload })).rejects.toThrow();
    await expect(storePreviewInR2("ws", "a/b", jpeg, { upload })).rejects.toThrow();
    await expect(storePreviewInR2("ws", "l", Buffer.from("basura"), { upload })).rejects.toMatchObject({
      code: "FETCH_FAILED",
    });
    expect(upload).not.toHaveBeenCalled();
  });
});
