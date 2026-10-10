import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const r2 = vi.hoisted(() => ({ leerBytesDeR2: vi.fn() }));
vi.mock("@/lib/imagenes/r2", () => r2);
const { imagenParaPdf } = await import("./imagen");

beforeEach(() => vi.clearAllMocks());

describe("imagenParaPdf", () => {
  it("pasa la WebP del bucket a JPEG sin agrandar y respeta el lado mayor", async () => {
    r2.leerBytesDeR2.mockResolvedValue(await sharp({ create: { width: 300, height: 200, channels: 3, background: "#808080" } }).webp().toBuffer());
    const img = await imagenParaPdf("https://pub-test.r2.dev/muestras/7/a.webp", 150);
    expect(img).not.toBeNull();
    expect([img!.width, img!.height]).toEqual([150, 100]);
    expect([img!.jpg[0], img!.jpg[1]]).toEqual([0xff, 0xd8]);
    const chica = await imagenParaPdf("https://pub-test.r2.dev/muestras/7/a.webp", 5000);
    expect(chica!.width).toBe(300);
  });
  it("sin imagen o con una rota, null (el PDF sale igual)", async () => {
    expect(await imagenParaPdf(null, 100)).toBeNull();
    r2.leerBytesDeR2.mockResolvedValue(null);
    expect(await imagenParaPdf("https://pub-test.r2.dev/muestras/7/b.webp", 100)).toBeNull();
    r2.leerBytesDeR2.mockResolvedValue(Buffer.from("no es una imagen"));
    expect(await imagenParaPdf("https://pub-test.r2.dev/muestras/7/c.webp", 100)).toBeNull();
  });
});
