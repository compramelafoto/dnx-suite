import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS, aplicarAjustes, type Ajustes } from "./ajustes";
import { recetaInicial } from "./receta";
import { generarVistaPrevia, renderizarPieza } from "./render";

/** Un degradé con color: cubre sombras, medios y luces en los tres canales. */
async function degrade(ancho: number, alto: number) {
  const px = Buffer.alloc(ancho * alto * 3);
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 3;
      px[i] = Math.round((x / ancho) * 255);
      px[i + 1] = Math.round((y / alto) * 255);
      px[i + 2] = 128;
    }
  return sharp(px, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 98 }).toBuffer();
}

function aLab([r, g, b]: number[]): [number, number, number] {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r!), lin(g!), lin(b!)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/** Promedio de color de 20 zonas (5 × 4) de una imagen RGB cruda. */
function zonas(data: Uint8Array | Buffer, ancho: number, alto: number): number[][] {
  const out: number[][] = [];
  for (let zy = 0; zy < 4; zy++)
    for (let zx = 0; zx < 5; zx++) {
      const s = [0, 0, 0];
      let n = 0;
      for (let y = Math.floor((zy * alto) / 4); y < Math.floor(((zy + 1) * alto) / 4); y++)
        for (let x = Math.floor((zx * ancho) / 5); x < Math.floor(((zx + 1) * ancho) / 5); x++) {
          const i = (y * ancho + x) * 3;
          s[0] += data[i]!; s[1] += data[i + 1]!; s[2] += data[i + 2]!; n++;
        }
      out.push(s.map((v) => v / n));
    }
  return out;
}

async function deltaPromedio(ajustes: Ajustes) {
  const original = await degrade(3000, 2000);
  const final = await renderizarPieza(original, { ...recetaInicial(), ajustes }, { ancho: 600, alto: 400 }, "SUAVE");
  // La vista previa como la arma el navegador: la vista previa del servidor + aplicarAjustes en 8 bits.
  const vista = await generarVistaPrevia(original);
  const { data } = await sharp(vista.jpg).resize(600, 400, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const ocho = new Uint8Array(data);
  aplicarAjustes(ocho, 3, ajustes);
  const a = zonas(final.data, 600, 400).map(aLab);
  const b = zonas(ocho, 600, 400).map(aLab);
  const delta = a.reduce((acc, la, i) => acc + Math.hypot(la[0] - b[i]![0], la[1] - b[i]![1], la[2] - b[i]![2]), 0) / a.length;
  return delta;
}

describe("vista previa contra archivo final", () => {
  it("sin ajustes, la diferencia promedio es menor a 2 (ΔE)", async () => {
    expect(await deltaPromedio(AJUSTES_NEUTROS)).toBeLessThan(2);
  });
  it("con ajustes fuertes, también", async () => {
    expect(await deltaPromedio({ ...AJUSTES_NEUTROS, exposicion: 20, contraste: 30, temperatura: -25, saturacion: 40, sombras: 30 })).toBeLessThan(2);
  });
});
