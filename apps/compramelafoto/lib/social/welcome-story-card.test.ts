import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-client", () => ({ getPublicUrl: (k: string) => k, uploadToR2: async () => undefined }));
vi.mock("@repo/db", () => ({ prisma: {}, Prisma: {} }));

const { prepararTarjeta } = await import("./welcome-stories");

async function logo(color: string, transparente: boolean) {
  const fondo = transparente ? { r: 0, g: 0, b: 0, alpha: 0 } : "#ffffff";
  return sharp({ create: { width: 400, height: 200, channels: 4, background: fondo } })
    .composite([{ input: { create: { width: 200, height: 80, channels: 4, background: color } }, left: 100, top: 60 }])
    .png()
    .toBuffer();
}

async function pixel(png: Uint8Array, x: number, y: number) {
  const { data, info } = await sharp(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return { r: data[i]!, a: data[i + 3]!, w: info.width, h: info.height };
}

describe("prepararTarjeta", () => {
  it("un logo oscuro va sobre tarjeta blanca del tamaño de la tarjeta, con esquinas redondeadas", async () => {
    const t = (await prepararTarjeta(await logo("#000000", true)))!;
    const borde = await pixel(t, 20, 235);
    expect([borde.w, borde.h]).toEqual([700, 470]);
    expect(borde.r).toBe(255);
    expect((await pixel(t, 0, 0)).a).toBe(0);
  });

  it("un logo blanco sobre transparente va sobre tarjeta oscura (si no, no se vería)", async () => {
    const t = (await prepararTarjeta(await logo("#ffffff", true)))!;
    expect((await pixel(t, 20, 235)).r).toBeLessThan(40);
  });

  it("un logo blanco sobre fondo blanco opaco no se toca: tarjeta blanca", async () => {
    const t = (await prepararTarjeta(await logo("#ff0000", false)))!;
    expect((await pixel(t, 20, 235)).r).toBe(255);
  });

  it("algo que no es una imagen no arma tarjeta", async () => {
    expect(await prepararTarjeta(Buffer.from("no soy un png"))).toBeNull();
  });
});
