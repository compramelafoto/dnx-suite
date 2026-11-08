import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/images/r2-client", () => ({}));

import { achicarAMiniatura, claveMiniatura, generarMiniaturas, LADO_MINIATURA_PX, type DepsMiniatura } from "./miniaturas";

const KEY = "fotoffice/site-trabajos/ws1/t1/abc123.jpg";

describe("claveMiniatura", () => {
  it("va a la carpeta miniaturas del mismo trabajo, en WebP", () => {
    expect(claveMiniatura(KEY)).toBe("fotoffice/site-trabajos/ws1/t1/miniaturas/abc123.webp");
    expect(claveMiniatura("fotoffice/site-trabajos/ws1/t1/foto")).toBe("fotoffice/site-trabajos/ws1/t1/miniaturas/foto.webp");
  });

  it("no arma una miniatura de una miniatura ni de una key sin carpeta", () => {
    expect(claveMiniatura("fotoffice/site-trabajos/ws1/t1/miniaturas/abc123.webp")).toBeNull();
    expect(claveMiniatura("suelta.jpg")).toBeNull();
    expect(claveMiniatura("carpeta/")).toBeNull();
  });
});

describe("achicarAMiniatura", () => {
  it("deja el lado largo en 800 px, en WebP, y no agranda las chicas", async () => {
    const grande = await sharp({ create: { width: 1200, height: 1800, channels: 3, background: "#806040" } }).jpeg().toBuffer();
    const meta = await sharp(await achicarAMiniatura(grande)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.height).toBe(LADO_MINIATURA_PX);
    expect(meta.width).toBe(533);

    const chica = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#806040" } }).png().toBuffer();
    const metaChica = await sharp(await achicarAMiniatura(chica)).metadata();
    expect([metaChica.width, metaChica.height]).toEqual([300, 200]);
  });
});

describe("generarMiniaturas", () => {
  function deps(falla?: string): DepsMiniatura & { guardadas: Map<string, string> } {
    const guardadas = new Map<string, string>();
    return {
      guardadas,
      bajar: vi.fn(async (key: string) => {
        if (key === falla) throw new Error("no está");
        return Buffer.from(key);
      }),
      achicar: vi.fn(async (b: Buffer) => b),
      subir: vi.fn(async (_b: Buffer, key: string) => ({ url: `https://media.test/${key}` })),
      guardar: vi.fn(async (id: string, url: string) => {
        guardadas.set(id, url);
      }),
    };
  }

  it("genera, sube y registra cada foto; saltea videos y fotos fuera de R2", async () => {
    const d = deps();
    const r = await generarMiniaturas(
      [
        { id: "f1", r2Key: KEY, tipo: "FOTO" },
        { id: "f2", r2Key: null, tipo: "FOTO" },
        { id: "v1", r2Key: null, tipo: "VIDEO_URL" },
      ],
      d,
    );
    expect(r).toEqual({ hechas: 1, salteadas: 2, fallidas: [] });
    expect(d.guardadas.get("f1")).toBe("https://media.test/fotoffice/site-trabajos/ws1/t1/miniaturas/abc123.webp");
  });

  it("un error en una foto no frena las demás", async () => {
    const otra = "fotoffice/site-trabajos/ws1/t1/otra.jpg";
    const d = deps(KEY);
    const r = await generarMiniaturas(
      [
        { id: "f1", r2Key: KEY, tipo: "FOTO" },
        { id: "f2", r2Key: otra, tipo: "FOTO" },
      ],
      d,
      1,
    );
    expect(r.hechas).toBe(1);
    expect(r.fallidas).toEqual([{ id: "f1", error: "no está" }]);
    expect(d.guardadas.has("f2")).toBe(true);
  });
});
