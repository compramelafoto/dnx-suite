import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { armarMarca } from "./marca";

describe("armarMarca", () => {
  it("sin logo y sin WhatsApp devuelve un PNG válido de al menos 200 px", async () => {
    const png = await armarMarca({ commercialName: "Foto & Video <Pérez>", logoUrl: null, whatsapp: null }, async () => null);
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width!).toBeGreaterThanOrEqual(200);
  });
  it("con logo y WhatsApp es más alto que sin WhatsApp", async () => {
    const logo = await sharp({ create: { width: 600, height: 200, channels: 4, background: "#ff8800" } }).png().toBuffer();
    const sin = await armarMarca({ commercialName: "X", logoUrl: "http://x/l.png", whatsapp: null }, async () => logo);
    const con = await armarMarca({ commercialName: "X", logoUrl: "http://x/l.png", whatsapp: "+54 9 11 5555-5555" }, async () => logo);
    expect((await sharp(con).metadata()).height!).toBeGreaterThan((await sharp(sin).metadata()).height!);
  });
  it("si el logo no se puede leer cae al nombre", async () => {
    const png = await armarMarca({ commercialName: "X", logoUrl: "http://x/l.png", whatsapp: null }, async () => Buffer.from("no es imagen"));
    expect((await sharp(png).metadata()).format).toBe("png");
  });
});
