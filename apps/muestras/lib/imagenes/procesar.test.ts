import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ImagenInvalida, procesarImagen } from "./procesar";

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
  it("el avatar sale cuadrado de 800 px, recortado al centro", async () => {
    const r = await procesarImagen(await jpeg(1600, 900), "avatar");
    expect([r.width, r.height]).toEqual([800, 800]);
  });
  it("no agranda una imagen chica", async () => {
    const r = await procesarImagen(await jpeg(800, 600), "obra");
    expect(r.width).toBe(800);
  });
  it("rechaza algo que no es imagen", async () => {
    await expect(procesarImagen(Buffer.from("hola"), "obra")).rejects.toThrow("No es una imagen válida");
  });
  it("el error de archivo inválido es de la persona, no del servidor", async () => {
    await expect(procesarImagen(Buffer.from("hola"), "obra")).rejects.toBeInstanceOf(ImagenInvalida);
  });
  it("rechaza una imagen con más de 50 megapíxeles sin decodificarla", async () => {
    // 8000 × 7000 = 56 MP. Se arma en PNG porque comprime casi a nada siendo un color liso.
    const grande = await sharp({ create: { width: 8000, height: 7000, channels: 3, background: "#000" } }).png().toBuffer();
    await expect(procesarImagen(grande, "obra")).rejects.toThrow("demasiados píxeles");
  });
});
