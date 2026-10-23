import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const bloques = [
  { id: "fondo", type: "BACKGROUND", name: "Fondo", pageIndex: 0, x: 0, y: 0, width: 1200, height: 600, rotation: 0, zIndex: 0, opacity: 1, locked: true, visible: true, configJson: { backgroundColor: "#fbfaf6", src: "https://r2.test/fondo.jpg", fit: "cover" } },
  { id: "foto", type: "IMAGE", name: "Foto", pageIndex: 0, x: 700, y: 100, width: 400, height: 400, rotation: 0, zIndex: 10, opacity: 1, locked: false, visible: true, configJson: { src: "https://r2.test/foto.jpg", fit: "cover", crop: { zoom: 1.5, x: -0.5, y: 0 }, srcWidth: 300, srcHeight: 200 } },
  { id: "titulo", type: "TEXT", name: "titulo", pageIndex: 0, x: 60, y: 200, width: 480, height: 120, rotation: 0, zIndex: 40, opacity: 1, locked: false, visible: true, configJson: { content: "Ana & Luis", fontFamily: "Playfair Display", fontSize: 60, color: "#333333", textAlign: "center" } },
];

vi.mock("@repo/db", () => ({
  prisma: {
    templateV2: { findUnique: vi.fn(async () => ({ name: "Boda", currentVersionId: "v1" })) },
    templateV2Version: { findUnique: vi.fn(async () => ({ canvasJson: { width: 1200, height: 600, dpi: 300 } })) },
    templateV2Block: { findMany: vi.fn(async ({ where }: { where: { pageIndex: number } }) => (where.pageIndex === 0 ? bloques : [])) },
  },
}));

let jpgRojo: Uint8Array;
beforeAll(async () => {
  jpgRojo = new Uint8Array(await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 200, g: 30, b: 30 } } }).jpeg().toBuffer());
  const mitad = (r: number, b: number) => sharp({ create: { width: 150, height: 200, channels: 3, background: { r, g: 30, b } } }).png().toBuffer();
  const foto = new Uint8Array(await sharp({ create: { width: 300, height: 200, channels: 3, background: "#000" } }).composite([{ input: await mitad(220, 30), left: 0, top: 0 }, { input: await mitad(30, 220), left: 150, top: 0 }]).jpeg().toBuffer());
  const fondo = new Uint8Array(await sharp({ create: { width: 120, height: 60, channels: 3, background: { r: 240, g: 232, b: 210 } } }).jpeg().toBuffer());
  const orig = globalThis.fetch;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
    String(url) === "https://r2.test/foto.jpg" ? new Response(foto as BodyInit) : String(url) === "https://r2.test/fondo.jpg" ? new Response(fondo as BodyInit) : orig(url, init),
  );
  void jpgRojo;
});

describe("exportar un pliego para el laboratorio", () => {
  it("da un JPG del tamaño exacto del pliego, a 300 ppp", async () => {
    const { exportarPliego } = await import("./exportar");
    const r = await exportarPliego("t1", 0);
    if (!r.ok) throw new Error(r.error);
    expect(r.nombre).toBe("pliego-01.jpg");
    const meta = await sharp(Buffer.from(r.jpg)).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.abs((meta.width ?? 0) - 1200)).toBeLessThanOrEqual(2);
    expect(Math.abs((meta.height ?? 0) - 600)).toBeLessThanOrEqual(2);
    expect(meta.density).toBe(300);
  }, 60_000);

  it("avisa si el pliego no existe", async () => {
    const { exportarPliego } = await import("./exportar");
    const r = await exportarPliego("t1", 5);
    expect(r.ok).toBe(false);
  });
});
