import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { qrSvg } from "./qr";

describe("qrSvg", () => {
  it("un cuadrado del lado pedido, con margen blanco y módulos negros", async () => {
    const { data, info } = await sharp(qrSvg("https://muestrasfotograficas.com/m/x/inauguracion", 230)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([230, 230]);
    const px = (x: number, y: number) => data[(y * info.width + x) * info.channels]!;
    for (const [x, y] of [[1, 1], [228, 1], [1, 228], [228, 228]] as const) expect(px(x, y)).toBeGreaterThan(240);
    let negros = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i]! < 20) negros++;
    expect(negros).toBeGreaterThan(230 * 230 * 0.2);
  });
  it("sin dirección, error", () => {
    expect(() => qrSvg("  ", 100)).toThrow();
  });
});
