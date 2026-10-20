import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS, aplicarAjustes, type Ajustes } from "./ajustes";
import { encuadreQueContiene } from "./encuadre";
import { cajaRotada, planDeRecorte } from "./geometria";
import { recetaInicial, type Receta } from "./receta";
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

function deltaZonas(a: Uint8Array | Buffer, b: Uint8Array | Buffer, ancho: number, alto: number): number {
  const la = zonas(a, ancho, alto).map(aLab);
  const lb = zonas(b, ancho, alto).map(aLab);
  return la.reduce((acc, x, i) => acc + Math.hypot(x[0] - lb[i]![0], x[1] - lb[i]![1], x[2] - lb[i]![2]), 0) / la.length;
}

async function deltaPromedio(ajustes: Ajustes) {
  const original = await degrade(3000, 2000);
  const final = await renderizarPieza(original, { ...recetaInicial(), ajustes }, { ancho: 600, alto: 400 }, "SUAVE");
  // La vista previa como la arma el navegador: la vista previa del servidor + aplicarAjustes en 8 bits.
  const vista = await generarVistaPrevia(original);
  const { data } = await sharp(vista.jpg).resize(600, 400, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const ocho = new Uint8Array(data);
  aplicarAjustes(ocho, 3, ajustes);
  return deltaZonas(final.data, ocho, 600, 400);
}

/**
 * ENCAJAR como lo arma `VistaPieza` en el navegador: el mismo `planDeRecorte` sobre la vista
 * previa, ajustes en 8 bits sólo sobre la foto, y la foto sobre el papel del color del borde.
 */
async function encajado(ajustes: Ajustes) {
  const original = await degrade(3000, 2000);
  // 13x18 parada (127 × 180 mm): la foto acostada entra con borde arriba y abajo.
  const receta: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "VERTICAL", colorBorde: "#ffffff", encuadre: encuadreQueContiene(1.5, 127 / 180), ajustes };
  const destino = { ancho: 400, alto: 567 };
  const final = await renderizarPieza(original, receta, destino, "SUAVE");
  const vista = await generarVistaPrevia(original);
  const plan = planDeRecorte(receta, cajaRotada(vista.ancho, vista.alto, 0), destino);
  const { data } = await sharp(vista.jpg)
    .extract(plan.recorte)
    .resize(plan.colocacion.width, plan.colocacion.height, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ocho = new Uint8Array(data);
  aplicarAjustes(ocho, 3, ajustes);
  const { data: vistaHoja } = await sharp({ create: { width: destino.ancho, height: destino.alto, channels: 3, background: "#ffffff" } })
    .composite([{ input: Buffer.from(ocho), raw: { width: plan.colocacion.width, height: plan.colocacion.height, channels: 3 }, left: plan.colocacion.left, top: plan.colocacion.top }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { delta: deltaZonas(final.data, vistaHoja, destino.ancho, destino.alto), final: final.data, vista: vistaHoja, ancho: destino.ancho };
}

describe("vista previa contra archivo final", () => {
  it("sin ajustes, la diferencia promedio es menor a 2 (ΔE)", async () => {
    expect(await deltaPromedio(AJUSTES_NEUTROS)).toBeLessThan(2);
  });
  it("con ajustes fuertes, también", async () => {
    expect(await deltaPromedio({ ...AJUSTES_NEUTROS, exposicion: 20, contraste: 30, temperatura: -25, saturacion: 40, sombras: 30 })).toBeLessThan(2);
  });
  it("ENCAJAR sin ajustes: ΔE menor a 2 y el borde es idéntico en los dos", async () => {
    const e = await encajado(AJUSTES_NEUTROS);
    expect(e.delta).toBeLessThan(2);
    const fila = (d: Uint8Array | Buffer, y: number) => Array.from(d.subarray(y * e.ancho * 3, (y + 1) * e.ancho * 3));
    for (const y of [0, 100, 149, 417, 566]) {
      expect(fila(e.final, y).every((v) => v === 255)).toBe(true);
      expect(fila(e.vista, y)).toEqual(fila(e.final, y));
    }
  });
  it("ENCAJAR con ajustes fuertes: ΔE menor a 2", async () => {
    expect((await encajado({ ...AJUSTES_NEUTROS, exposicion: 20, contraste: 30, temperatura: -25, saturacion: 40 })).delta).toBeLessThan(2);
  });
});
