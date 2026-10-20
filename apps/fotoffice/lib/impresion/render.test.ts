import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS, aplicarAjustes } from "./ajustes";
import { encuadreQueContiene, encuadreQueLlena } from "./encuadre";
import { anguloTotal, recetaInicial, type Receta } from "./receta";
import { MENSAJE_HEIC, componerCopia, componerHoja, esHeicSinSoporte, generarVistaPrevia, leerOriginal, renderizarPieza, type PiezaRaw } from "./render";
import { disposicionCarnet } from "./plancha";
import { cajaRotada, rectanguloEnPixeles, tamanoVistaPrevia } from "./geometria";

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

  it("la vista previa mide lo que dice tamanoVistaPrevia (también con la foto girada por EXIF)", async () => {
    const girada = await sharp(await foto(3001, 2003)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    for (const [buf, ancho, alto] of [[await foto(4001, 2999), 4001, 2999], [girada, 2003, 3001]] as const) {
      const v = await generarVistaPrevia(buf);
      const meta = await sharp(v.jpg).metadata();
      expect([v.ancho, v.alto]).toEqual([meta.width, meta.height]);
      expect({ ancho: v.ancho, alto: v.alto }).toEqual(tamanoVistaPrevia(ancho, alto));
    }
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

  it("HEIC del iPhone (HEVC): avisa que hay que pasarla a JPG; AVIF sí se acepta", () => {
    expect(esHeicSinSoporte({ format: "heif", compression: "hevc" })).toBe(true);
    expect(esHeicSinSoporte({ format: "heif", compression: "av1" })).toBe(false);
    expect(esHeicSinSoporte({ format: "jpeg" })).toBe(false);
  });

  it("un archivo HEIC que sharp no puede abrir da el mensaje de HEIC, no el genérico", async () => {
    // Una caja `ftyp` de HEIC sin imagen adentro: como la que el motor no sabe decodificar.
    const ftyp = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.from([0, 0, 0, 0]), Buffer.from("mif1heic")]);
    const heic = Buffer.concat([ftyp, Buffer.alloc(64)]);
    await expect(leerOriginal(heic)).rejects.toMatchObject({ message: MENSAJE_HEIC, definitivo: true });
    expect(MENSAJE_HEIC).toBe("Las fotos HEIC del iPhone no se pueden abrir acá: exportala como JPG (en WhatsApp sale así).");
  });
});

const pixel = (p: PiezaRaw, x: number, y: number) => {
  const i = (y * p.ancho + x) * 3;
  return [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!];
};
const encajar = (encuadre: Receta["encuadre"], extra: Partial<Receta> = {}): Receta => ({
  ...recetaInicial(),
  modo: "ENCAJAR",
  orientacion: "HORIZONTAL",
  colorBorde: "#ffffff",
  encuadre,
  ...extra,
});

/**
 * Referencia CONGELADA: el pipeline de la etapa 1, copiado a propósito (no importar del motor).
 * Una receta de la etapa 1 tiene que seguir dando byte por byte el mismo archivo; si el motor
 * cambia, esta copia no debe cambiar con él.
 */
async function piezaComoEnLaEtapa1(original: Buffer, receta: Receta, destino: { ancho: number; alto: number }, sigma: number) {
  const meta = await sharp(original).metadata();
  const girada = (meta.orientation ?? 1) >= 5;
  const ancho = girada ? meta.height! : meta.width!;
  const alto = girada ? meta.width! : meta.height!;
  const angulo = anguloTotal(receta);
  const rect = rectanguloEnPixeles(receta.encuadre, cajaRotada(ancho, alto, angulo), angulo % 90 === 0 ? 0 : 2);
  const blanco = { r: 255, g: 255, b: 255 };
  let p = sharp(original).autoOrient().flatten({ background: blanco });
  if (angulo !== 0) p = p.rotate(angulo, { background: blanco });
  const { data, info } = await p
    .extract(rect)
    .resize(destino.ancho, destino.alto, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("rgb16")
    .raw({ depth: "ushort" })
    .toBuffer({ resolveWithObject: true });
  const u16 = new Uint16Array(data.length / 2);
  Buffer.from(u16.buffer).set(data);
  aplicarAjustes(u16, 3, receta.ajustes);
  return sharp(u16, { raw: { width: info.width, height: info.height, channels: 3 } }).toColourspace("srgb").sharpen({ sigma }).raw().toBuffer();
}

describe("motor de impresión: copias (etapa 2)", () => {
  it("una receta de la etapa 1 da exactamente el mismo archivo que antes", async () => {
    const r: Receta = { ...recetaInicial(), enderezar: 3, encuadre: { x: 0.1, y: 0.05, ancho: 0.6, alto: 0.7 }, ajustes: { ...AJUSTES_NEUTROS, exposicion: 12, saturacion: -8 } };
    const original = await mitades(900, 700);
    const nuevo = await renderizarPieza(original, r, { ancho: 240, alto: 280 }, "NORMAL");
    const viejo = await piezaComoEnLaEtapa1(original, r, { ancho: 240, alto: 280 }, 0.8);
    expect(nuevo.data.equals(viejo)).toBe(true);
  });

  it("ENCAJAR: la foto entera sobre el papel y el borde blanco puro", async () => {
    const p = await renderizarPieza(await foto(2000, 1000), encajar({ x: 0, y: -0.5, ancho: 1, alto: 2 }), { ancho: 300, alto: 300 }, "SUAVE");
    expect([p.ancho, p.alto, p.data.length]).toEqual([300, 300, 300 * 300 * 3]);
    // Filas 0–74 y 225–299: borde; 75–224: foto.
    for (const y of [0, 40, 74, 225, 299]) expect(pixel(p, 150, y)).toEqual([255, 255, 255]);
    const [r, g] = pixel(p, 150, 150);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeLessThan(80);
  });

  it("el borde conserva su color exacto aunque se aclare la foto", async () => {
    const r = encajar({ x: 0, y: -0.5, ancho: 1, alto: 2 }, { colorBorde: "#102030", ajustes: { ...AJUSTES_NEUTROS, exposicion: 50 } });
    const p = await renderizarPieza(await foto(2000, 1000, { r: 64, g: 64, b: 64 }), r, { ancho: 300, alto: 300 }, "FUERTE");
    expect(pixel(p, 150, 5)).toEqual([16, 32, 48]);
    expect(pixel(p, 150, 294)).toEqual([16, 32, 48]);
    expect(pixel(p, 150, 150)[0]!).toBeGreaterThan(100);
  });

  it("ENCAJAR con una foto de celular girada por EXIF: queda derecha, con borde a los costados", async () => {
    // Guardada 400×300 negro|blanco con orientación 6: derecha es 300×400, ARRIBA negra y ABAJO blanca.
    const girada = await sharp(await mitades(400, 300)).withMetadata({ orientation: 6 }).jpeg({ quality: 100 }).toBuffer();
    const r = encajar(encuadreQueContiene(300 / 400, 300 / 200));
    const p = await renderizarPieza(girada, r, { ancho: 300, alto: 200 }, "SUAVE");
    // Columnas 0–74 y 225–299: borde; la foto, en el medio.
    for (const [x, y] of [[20, 30], [20, 170], [280, 100]] as const) expect(pixel(p, x, y)).toEqual([255, 255, 255]);
    for (const x of [110, 190]) {
      expect(pixel(p, x, 30)[0]!).toBeLessThan(40);
      expect(pixel(p, x, 170)[0]!).toBeGreaterThan(215);
    }
  });

  it("panorámica 3:1 encajada en 10x15: una franja centrada con borde arriba y abajo", async () => {
    const r = encajar(encuadreQueContiene(3, 447 / 300));
    const p = await renderizarPieza(await foto(900, 300), r, { ancho: 447, alto: 300 }, "SUAVE");
    expect([p.ancho, p.alto]).toEqual([447, 300]);
    expect(pixel(p, 223, 10)).toEqual([255, 255, 255]);
    expect(pixel(p, 223, 290)).toEqual([255, 255, 255]);
    expect(pixel(p, 223, 150)[0]!).toBeGreaterThan(180);
  });

  it("una foto chiquita se agranda a la medida exacta sin romper", async () => {
    const r: Receta = { ...recetaInicial(), orientacion: "HORIZONTAL", encuadre: encuadreQueLlena(40 / 30, 1795 / 1205) };
    const p = await renderizarPieza(await foto(40, 30), r, { ancho: 1795, alto: 1205 }, "SUAVE");
    expect([p.ancho, p.alto, p.data.length]).toEqual([1795, 1205, 1795 * 1205 * 3]);
  });

  it("la hoja de una copia acostada sale parada: medida exacta, 300 ppp, sRGB y 4:4:4", async () => {
    const r: Receta = { ...recetaInicial(), orientacion: "HORIZONTAL", encuadre: encuadreQueLlena(1.5, 1795 / 1205) };
    const pieza = await renderizarPieza(await foto(600, 400), r, { ancho: 1795, alto: 1205 }, "SUAVE");
    const meta = await sharp(await componerCopia(pieza, true, 300)).metadata();
    expect([meta.width, meta.height, meta.density, meta.chromaSubsampling, meta.hasProfile]).toEqual([1205, 1795, 300, "4:4:4", true]);
    const parada = await sharp(await componerCopia(pieza, false, 300)).metadata();
    expect([parada.width, parada.height]).toEqual([1795, 1205]);
  });
  it("ENCAJAR con enderezado: las esquinas que deja el giro quedan EXACTAMENTE del color del borde", async () => {
    // Borde blanco y borde negro: un fondo blanco pasado por ajustes/nitidez no se confundiría con el negro.
    for (const colorBorde of ["#000000", "#ffffff", "#102030"]) {
      const r = encajar({ x: 0, y: 0, ancho: 1, alto: 1 }, { colorBorde, enderezar: 10, ajustes: { ...AJUSTES_NEUTROS, exposicion: 50 } });
      const p = await renderizarPieza(await foto(600, 400, { r: 64, g: 64, b: 64 }), r, { ancho: 300, alto: 200 }, "FUERTE");
      const n = Number.parseInt(colorBorde.slice(1), 16);
      const esperado = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      for (const [x, y] of [[0, 0], [299, 0], [0, 199], [299, 199], [2, 2], [297, 197]] as const) expect(pixel(p, x, y)).toEqual(esperado);
      expect(pixel(p, 150, 100)[0]!).toBeGreaterThan(100); // el centro es foto aclarada
    }
  });
});
