/**
 * Foto carnet: medidas, hojas de impresión y cuántas fotos entran en una plancha. Lógica pura
 * (sin navegador), traída del editor de CompraMeLaFoto. No confundir con el carnet de socio
 * (`lib/carnet/*`), que es una credencial.
 */

export const CM_POR_PULGADA = 2.54;
/** Resolución de impresión: la del laboratorio y la de las copias del mostrador. */
export const DPI_IMPRESION = 300;
/** Margen de la plancha y separación entre fotos, en cm. */
export const MARGEN_CM = 0.3;
export const SEPARACION_CM = 0.05;
/** Medida mínima de un lado de la foto, en cm. */
export const LADO_MINIMO_CM = 2;

export function cmAPx(cm: number, dpi: number): number {
  return Math.round((cm / CM_POR_PULGADA) * dpi);
}

export type MedidaCarnet = { etiqueta: string; anchoCm: number; altoCm: number };

/** Las medidas más pedidas en el mostrador (DNI, pasaporte, visas, legajos). */
export const MEDIDAS_CARNET: readonly MedidaCarnet[] = [
  { etiqueta: "4 × 4 cm", anchoCm: 4, altoCm: 4 },
  { etiqueta: "3,5 × 4,5 cm", anchoCm: 3.5, altoCm: 4.5 },
  { etiqueta: "3 × 3 cm", anchoCm: 3, altoCm: 3 },
  { etiqueta: "5 × 5 cm", anchoCm: 5, altoCm: 5 },
  { etiqueta: "3 × 4 cm", anchoCm: 3, altoCm: 4 },
  { etiqueta: "5 × 7 cm", anchoCm: 5, altoCm: 7 },
  { etiqueta: "2,4 × 3,2 cm", anchoCm: 2.4, altoCm: 3.2 },
  { etiqueta: "2,6 × 3,2 cm", anchoCm: 2.6, altoCm: 3.2 },
  { etiqueta: "2,5 × 3,5 cm", anchoCm: 2.5, altoCm: 3.5 },
];

export type HojaImpresion = { clave: "10x15" | "13x18"; etiqueta: string; anchoCm: number; altoCm: number };

/** Las copias en las que se imprime la plancha, con el margen de corte del laboratorio. */
export const HOJAS: readonly HojaImpresion[] = [
  { clave: "10x15", etiqueta: "Copia 10 × 15", anchoCm: 10.2, altoCm: 15.2 },
  { clave: "13x18", etiqueta: "Copia 13 × 18", anchoCm: 12.7, altoCm: 17.8 },
];

export type Grilla = {
  cols: number;
  rows: number;
  total: number;
  startX: number;
  startY: number;
  gridWidth: number;
  gridHeight: number;
};

/**
 * Cuántas fotos entran en la hoja y dónde arranca la grilla (centrada). Prueba con el margen
 * pedido y sin margen, y se queda con la que entra más. `maxTotal` limita la cantidad (por
 * ejemplo, si el cliente pide sólo 4).
 */
export function calcularGrilla({
  sheetWidthPx,
  sheetHeightPx,
  photoWidthPx,
  photoHeightPx,
  marginPx,
  gapPx,
  maxTotal,
}: {
  sheetWidthPx: number;
  sheetHeightPx: number;
  photoWidthPx: number;
  photoHeightPx: number;
  marginPx: number;
  gapPx: number;
  maxTotal?: number;
}): Grilla {
  const armar = (cols: number, rows: number): Grilla => {
    const gridWidth = cols * photoWidthPx + (cols - 1) * gapPx;
    const gridHeight = rows * photoHeightPx + (rows - 1) * gapPx;
    return {
      cols,
      rows,
      total: cols * rows,
      startX: Math.round((sheetWidthPx - gridWidth) / 2),
      startY: Math.round((sheetHeightPx - gridHeight) / 2),
      gridWidth,
      gridHeight,
    };
  };

  const conMargen = (margen: number): Grilla => {
    const usableWidth = Math.max(0, sheetWidthPx - margen * 2);
    const usableHeight = Math.max(0, sheetHeightPx - margen * 2);
    const cols = Math.max(1, Math.floor((usableWidth + gapPx) / (photoWidthPx + gapPx)));
    const rows = Math.max(1, Math.floor((usableHeight + gapPx) / (photoHeightPx + gapPx)));
    return armar(cols, rows);
  };

  // Con tope: la combinación de columnas y filas que más se acerca sin pasarse.
  const limitar = (g: Grilla): Grilla => {
    if (!maxTotal || maxTotal < 1 || g.total <= maxTotal) return g;
    let mejor = armar(1, 1);
    for (let c = 1; c <= g.cols; c += 1) {
      for (let r = 1; r <= g.rows; r += 1) {
        if (c * r <= maxTotal && c * r > mejor.total) mejor = armar(c, r);
      }
    }
    return mejor;
  };

  let mejor = limitar(conMargen(marginPx));
  if (marginPx !== 0) {
    const sinMargen = limitar(conMargen(0));
    if (sinMargen.total > mejor.total) mejor = sinMargen;
  }
  return mejor;
}

/** La grilla de una medida en una hoja, a la resolución de impresión. */
export function grillaDe(
  medida: { anchoCm: number; altoCm: number },
  hoja: { anchoCm: number; altoCm: number },
  maxTotal?: number,
  dpi = DPI_IMPRESION,
): Grilla {
  return calcularGrilla({
    sheetWidthPx: cmAPx(hoja.anchoCm, dpi),
    sheetHeightPx: cmAPx(hoja.altoCm, dpi),
    photoWidthPx: cmAPx(medida.anchoCm, dpi),
    photoHeightPx: cmAPx(medida.altoCm, dpi),
    marginPx: cmAPx(MARGEN_CM, dpi),
    gapPx: cmAPx(SEPARACION_CM, dpi),
    maxTotal,
  });
}

/** Cómo se llama el archivo: dice la medida, la hoja y la cantidad, para el laboratorio. */
export function nombreDePlancha(
  medida: { anchoCm: number; altoCm: number },
  hoja: HojaImpresion,
  total: number,
  ahora: Date,
  cliente?: string | null,
): string {
  const cm = (n: number) => String(n).replace(".", ",");
  const dos = (n: number) => String(n).padStart(2, "0");
  const fecha = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}_${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
  const quien = cliente
    ? `_${cliente
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40)}`
    : "";
  return `foto-carnet_${cm(medida.anchoCm)}x${cm(medida.altoCm)}cm_${total}u_${hoja.clave}${quien}_${fecha}.jpg`;
}

/**
 * Le escribe la resolución al JPEG (segmento JFIF) para que el laboratorio y la impresora lo
 * lean a 300 dpi y no a 72: el navegador lo guarda sin ese dato. Si el archivo no trae el
 * segmento JFIF, lo agrega después del inicio.
 */
export function marcarDpiJpeg(bytes: Uint8Array, dpi = DPI_IMPRESION): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const alto = (dpi >> 8) & 0xff;
  const bajo = dpi & 0xff;
  const esJfif =
    bytes[2] === 0xff &&
    bytes[3] === 0xe0 &&
    bytes.length >= 18 &&
    bytes[6] === 0x4a && // J
    bytes[7] === 0x46 && // F
    bytes[8] === 0x49 && // I
    bytes[9] === 0x46 && // F
    bytes[10] === 0x00;
  if (esJfif) {
    const copia = bytes.slice();
    copia[13] = 1; // unidades: puntos por pulgada
    copia[14] = alto;
    copia[15] = bajo;
    copia[16] = alto;
    copia[17] = bajo;
    return copia;
  }
  const app0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, alto, bajo, alto, bajo, 0x00, 0x00,
  ]);
  const salida = new Uint8Array(bytes.length + app0.length);
  salida.set(bytes.subarray(0, 2), 0);
  salida.set(app0, 2);
  salida.set(bytes.subarray(2), 2 + app0.length);
  return salida;
}
