import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { procesarImagen } from "./procesar";

async function jpeg(w: number, h: number) {
  return sharp({ create: { width: w, height: h, channels: 3, background: "#888" } }).jpeg().toBuffer();
}

describe("procesarImagen", () => {
  it("achica una obra a 2000 px de lado mayor y la pasa a webp", async () => {
    const r = await procesarImagen(await jpeg(4000, 3000), "obra");
    expect(r.width).toBe(2000);
    expect(r.height).toBe(1500);
    expect(r.contentType).toBe("image/webp");
  });
  it("la portada va a 1600 px", async () => {
    const r = await procesarImagen(await jpeg(3000, 4000), "portada");
    expect(r.height).toBe(1600);
  });
  it("no agranda una imagen chica", async () => {
    const r = await procesarImagen(await jpeg(800, 600), "obra");
    expect(r.width).toBe(800);
  });
  it("rechaza algo que no es imagen", async () => {
    await expect(procesarImagen(Buffer.from("hola"), "obra")).rejects.toThrow("No es una imagen válida");
  });
});
