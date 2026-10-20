import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS } from "./ajustes";
import { recetaInicial, type Receta } from "./receta";
import { componerHoja, generarVistaPrevia, leerOriginal, renderizarPieza } from "./render";
import { disposicionCarnet } from "./plancha";

async function foto(ancho: number, alto: number, color = { r: 200, g: 40, b: 40 }) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: color } }).jpeg({ quality: 95 }).toBuffer();
}
/** Mitad izquierda negra, mitad derecha blanca: sirve para ver orientación y nitidez. */
async function mitades(ancho: number, alto: number) {
  const px = Buffer.alloc(ancho * alto * 3);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) px.fill(x < ancho / 2 ? 0 : 255, (y * ancho + x) * 3, (y * ancho + x) * 3 + 3);
  return sharp(px, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
}
const promedio = async (data: Buffer) => {
  const s = await sharp(data, { raw: { width: 1, height: data.length / 3, channels: 3 } }).stats();
  return s.channels.map((c) => c.mean);
};

describe("motor de impresión", () => {
  it("lee las medidas ya derechas (orientación EXIF 6 = girada 90°)", async () => {
    const girada = await sharp(await foto(400, 300)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const info = await leerOriginal(girada);
    expect([info.ancho, info.alto]).toEqual([300, 400]);
  });

  it("la vista previa queda en 1600 px de lado mayor y no agranda fotos chicas", async () => {
    expect((await generarVistaPrevia(await foto(4000, 3000))).ancho).toBe(1600);
    expect((await generarVistaPrevia(await foto(800, 600))).ancho).toBe(800);
  });

  it("la pieza sale exactamente del tamaño pedido", async () => {
    const p = await renderizarPieza(await foto(3000, 2000), recetaInicial(), { ancho: 472, alto: 472 }, "NORMAL");
    expect([p.ancho, p.alto, p.data.length]).toEqual([472, 472, 472 * 472 * 3]);
  });

  it("respeta la orientación EXIF al recortar la mitad izquierda", async () => {
    // Original 400×300 negro|blanco, marcado como girado 180°: derecho, la izquierda es BLANCA.
    const base = await mitades(400, 300);
    const girada = await sharp(base).withMetadata({ orientation: 3 }).jpeg({ quality: 100 }).toBuffer();
    const r: Receta = { ...recetaInicial(), encuadre: { x: 0, y: 0, ancho: 0.4, alto: 1 } };
    const p = await renderizarPieza(girada, r, { ancho: 100, alto: 100 }, "SUAVE");
    const [rr] = await promedio(p.data);
    expect(rr).toBeGreaterThan(230);
  });

  it("convierte P3 a sRGB sin apagar el color", async () => {
    // sharp, al etiquetar con "p3", convierte los píxeles: el archivo guarda valores P3 (rojo más bajo)
    // que, bien convertidos de vuelta, tienen que dar el sRGB original. Sin conversión se leería el rojo apagado.
    const p3 = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 230, g: 60, b: 60 } } })
      .withIccProfile("p3")
      .jpeg({ quality: 100 })
      .toBuffer();
    const p = await renderizarPieza(p3, recetaInicial(), { ancho: 50, alto: 50 }, "SUAVE");
    const [r, g] = await promedio(p.data);
    expect(r).toBeGreaterThanOrEqual(225);
    expect(r).toBeLessThanOrEqual(236);
    expect(g).toBeLessThanOrEqual(70);
  });

  it("enderezar al borde no revienta", async () => {
    const r: Receta = { ...recetaInicial(), enderezar: 7.3, encuadre: { x: 0.5, y: 0.5, ancho: 0.5, alto: 0.5 } };
    await expect(renderizarPieza(await foto(1001, 777), r, { ancho: 120, alto: 90 }, "NORMAL")).resolves.toBeTruthy();
  });

  it("los ajustes se aplican en el archivo final (exposición +50 aclara)", async () => {
    const gris = await foto(200, 200, { r: 64, g: 64, b: 64 });
    const normal = await promedio((await renderizarPieza(gris, recetaInicial(), { ancho: 50, alto: 50 }, "SUAVE")).data);
    const clara = await promedio(
      (await renderizarPieza(gris, { ...recetaInicial(), ajustes: { ...AJUSTES_NEUTROS, exposicion: 50 } }, { ancho: 50, alto: 50 }, "SUAVE")).data,
    );
    expect(clara[0]!).toBeGreaterThan(normal[0]! * 1.5);
  });

  it("no desenfoca: el borde negro|blanco sigue siendo un salto de pocos píxeles", async () => {
    const p = await renderizarPieza(await mitades(1200, 1200), recetaInicial(), { ancho: 600, alto: 600 }, "SUAVE");
    const fila = 300;
    const v = (x: number) => p.data[(fila * 600 + x) * 3]!;
    // Entre el 20 % y el 80 % del salto tiene que haber como mucho 4 píxeles.
    let desde = -1, hasta = -1;
    for (let x = 280; x < 320; x++) {
      if (desde < 0 && v(x) > 51) desde = x;
      if (hasta < 0 && v(x) > 204) hasta = x;
    }
    expect(desde).toBeGreaterThan(0);
    expect(hasta).toBeGreaterThan(0);
    expect(hasta - desde).toBeLessThanOrEqual(1);
  });

  it("la hoja final: medidas exactas, 300 ppp grabados, sRGB embebido y fondo blanco", async () => {
    const d = disposicionCarnet({ anchoMm: 40, altoMm: 40 }, { anchoMm: 102, altoMm: 152 }, 300);
    const pieza = await renderizarPieza(await foto(1000, 1000), recetaInicial(), d.pieza, "SUAVE");
    const jpg = await componerHoja({ ancho: 1205, alto: 1795 }, pieza, d, 300, true);
    const meta = await sharp(jpg).metadata();
    expect([meta.width, meta.height, meta.format, meta.density, meta.chromaSubsampling]).toEqual([1205, 1795, "jpeg", 300, "4:4:4"]);
    expect(meta.hasProfile).toBe(true);
    const { data } = await sharp(jpg).extract({ left: 0, top: 0, width: 5, height: 5 }).raw().toBuffer({ resolveWithObject: true });
    expect(Math.min(...data)).toBeGreaterThan(250);
  });

  it("rechaza lo que no es imagen y lo que pasa los 60 megapíxeles", async () => {
    await expect(leerOriginal(Buffer.from("hola"))).rejects.toMatchObject({ definitivo: true });
    const enorme = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: "#000" } }).jpeg().toBuffer();
    await expect(leerOriginal(enorme)).rejects.toMatchObject({ definitivo: true });
  });
});
