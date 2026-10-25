/** Ayudas de PRUEBA: arman PNG RGBA de 8 bits a mano (sólo las usan los tests). */
import { deflateSync } from "node:zlib";

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

function chunk(tipo: string, datos: Buffer): Buffer {
  // El CRC no se valida en el servidor (zlib ya controla los datos); acá va en cero.
  return Buffer.concat([u32(datos.length), Buffer.from(tipo, "ascii"), datos, u32(0)]);
}

export type Pixel = [number, number, number, number];

export function crearPng(ancho: number, alto: number, pixel: (x: number, y: number) => Pixel, opciones: { color?: number; sinIend?: boolean } = {}): Buffer {
  const ihdr = Buffer.concat([u32(ancho), u32(alto), Buffer.from([8, opciones.color ?? 6, 0, 0, 0])]);
  const filas: Buffer[] = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 4);
    for (let x = 0; x < ancho; x++) {
      const [r, g, b, a] = pixel(x, y);
      fila.set([r, g, b, a], 1 + x * 4);
    }
    filas.push(fila);
  }
  const partes = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(filas)))];
  if (!opciones.sinIend) partes.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(partes);
}

export const TRANSPARENTE: Pixel = [0, 0, 0, 0];
export const NEGRO: Pixel = [10, 10, 10, 255];

/** Una firma de mentira: una diagonal gruesa y una onda sobre fondo transparente. */
export function pngConTrazo(ancho = 600, alto = 200): Buffer {
  return crearPng(ancho, alto, (x, y) => {
    const diag = Math.abs(y - Math.round((x * alto) / ancho)) < 3;
    const onda = Math.abs(y - (alto / 2 + 30 * Math.sin(x / 20))) < 2;
    return diag || onda ? NEGRO : TRANSPARENTE;
  });
}

export function pngVacio(ancho = 600, alto = 200): Buffer {
  return crearPng(ancho, alto, () => TRANSPARENTE);
}

export const aDataUrl = (png: Buffer | Uint8Array): string => `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
