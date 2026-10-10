import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FotoNoProcesable, generarVariantes } from "./procesar";

async function jpeg(w: number, h: number, extra?: { orientation?: number; exif?: boolean }): Promise<Buffer> {
  let s = sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 40, b: 40 } } }).jpeg();
  if (extra?.exif) s = s.withExif({ IFD0: { Copyright: "Estudio X", Software: "prueba" }, IFD3: { GPSLatitudeRef: "S" } });
  if (extra?.orientation) s = s.withMetadata({ orientation: extra.orientation });
  return s.toBuffer();
}

describe("generarVariantes (sharp real)", () => {
  it("achica una foto grande a 2048 y 480 de lado mayor, en JPEG", async () => {
    const v = await generarVariantes(await jpeg(3000, 2000));
    const vm = await sharp(v.vista).metadata();
    const mm = await sharp(v.mini).metadata();
    expect([vm.format, vm.width, vm.height]).toEqual(["jpeg", 2048, 1365]);
    expect([mm.format, mm.width, mm.height]).toEqual(["jpeg", 480, 320]);
    expect([v.width, v.height]).toEqual([3000, 2000]);
  });

  it("no agranda una foto chica", async () => {
    const v = await generarVariantes(await jpeg(300, 200));
    const vm = await sharp(v.vista).metadata();
    const mm = await sharp(v.mini).metadata();
    expect([vm.width, vm.height]).toEqual([300, 200]);
    expect([mm.width, mm.height]).toEqual([300, 200]);
  });

  it("aplica la orientación EXIF: una foto de 600x400 con orientación 6 sale de 400x600", async () => {
    const original = await jpeg(600, 400, { orientation: 6 });
    expect((await sharp(original).metadata()).orientation).toBe(6);
    const v = await generarVariantes(original);
    const vm = await sharp(v.vista).metadata();
    const mm = await sharp(v.mini).metadata();
    expect([vm.width, vm.height]).toEqual([400, 600]);
    expect([mm.width, mm.height]).toEqual([320, 480]);
    expect([v.width, v.height]).toEqual([400, 600]);
    expect(vm.orientation ?? 1).toBe(1);
  });

  it("quita los metadatos (EXIF, GPS) de las derivadas", async () => {
    const original = await jpeg(800, 600, { exif: true });
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const v = await generarVariantes(original);
    for (const b of [v.vista, v.mini]) {
      const m = await sharp(b).metadata();
      expect(m.exif).toBeUndefined();
      expect(m.xmp).toBeUndefined();
      expect(m.iptc).toBeUndefined();
    }
  });

  it("acepta PNG", async () => {
    const png = await sharp({ create: { width: 100, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer();
    const v = await generarVariantes(png);
    expect((await sharp(v.vista).metadata()).format).toBe("jpeg");
  });

  it("rechaza lo que no es imagen o no es JPG/PNG, como error definitivo", async () => {
    await expect(generarVariantes(Buffer.from("esto no es una foto"))).rejects.toMatchObject({ definitivo: true });
    const webp = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).webp().toBuffer();
    const err = await generarVariantes(webp).catch((e) => e);
    expect(err).toBeInstanceOf(FotoNoProcesable);
    expect(err.definitivo).toBe(true);
  });
});
