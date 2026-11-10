import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { agregarDoblez } from "./render-laboratorio";
import { recetaInicial, type Receta } from "./receta";

// Un frente de 300 x 400 px que representa 30 x 40 cm: el doblez de 5 cm son 50 px por lado.
async function frente(): Promise<Buffer> {
  return sharp({ create: { width: 300, height: 400, channels: 3, background: "#ff0000" } }).jpeg().toBuffer();
}
const papel = { anchoMm: 300, altoMm: 400 };
const receta = (r: Partial<Receta>): Receta => ({ ...recetaInicial(), orientacion: "VERTICAL", ...r });

describe("agregarDoblez", () => {
  for (const doblez of ["ESPEJO", "DESENFOCADO", "COLOR", "ENVOLVENTE"] as const) {
    it(`${doblez}: suma 5 cm por lado`, async () => {
      const m = await sharp(await agregarDoblez(await frente(), receta({ doblez }), papel)).metadata();
      expect([m.width, m.height]).toEqual([400, 500]);
    });
  }
  it("COLOR pinta el lateral del color elegido", async () => {
    const out = await agregarDoblez(await frente(), receta({ doblez: "COLOR", colorDoblez: "#000000" }), papel);
    const { data } = await sharp(out).extract({ left: 5, top: 250, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect(Math.max(...data)).toBeLessThan(30);
  });
  it("sin elegir, va en espejo (el lateral repite el rojo del borde)", async () => {
    const out = await agregarDoblez(await frente(), receta({}), papel);
    const { data } = await sharp(out).extract({ left: 5, top: 250, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(200);
  });
});
