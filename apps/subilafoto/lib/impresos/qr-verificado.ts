import QRCode from "qrcode";
import jsQR from "jsqr";

/**
 * El QR que va a la imprenta, leído antes de entregarlo.
 *
 * El criterio 2.13 del backlog pide que el QR **se decodifique y valide** antes
 * de permitir la descarga, y tiene razón: un QR que no escanea se descubre
 * cuando ya se imprimieron doscientas tarjetas y la fiesta es esa noche. No hay
 * arreglo.
 *
 * Por eso se genera con una librería y se lee con otra distinta. Si las dos
 * coinciden, el código es bueno. Confiar en que el generador funcionó sería
 * confiar en la misma pieza que se quiere verificar.
 */

/** Módulos de margen blanco alrededor. Cuatro es el mínimo de la norma. */
const ZONA_DE_SILENCIO = 4;
/** Píxeles por módulo en el bitmap de verificación. Con menos, el lector falla. */
const PIXELES_POR_MODULO = 8;

/** La matriz de módulos: `true` es negro. */
export async function matrizDelQr(url: string): Promise<boolean[][]> {
  if (!url.trim()) throw new Error("No se puede armar un QR sin dirección.");

  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const lado = qr.modules.size;
  const datos = qr.modules.data;

  const matriz: boolean[][] = [];
  for (let y = 0; y < lado; y++) {
    const fila: boolean[] = [];
    for (let x = 0; x < lado; x++) fila.push(Boolean(datos[y * lado + x]));
    matriz.push(fila);
  }
  return matriz;
}

/**
 * Convierte la matriz en píxeles para poder leerla.
 *
 * Se arma a mano y no con un canvas: en una función de servidor no hay canvas,
 * y para esto alcanza con un arreglo de bytes.
 */
export function aBitmap(matriz: boolean[][]): {
  datos: Uint8ClampedArray;
  ancho: number;
  alto: number;
} {
  const lado = matriz.length;
  const conMargen = lado + ZONA_DE_SILENCIO * 2;
  const pixeles = conMargen * PIXELES_POR_MODULO;

  const datos = new Uint8ClampedArray(pixeles * pixeles * 4).fill(255);

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      if (!matriz[y]![x]) continue;

      const desdeX = (x + ZONA_DE_SILENCIO) * PIXELES_POR_MODULO;
      const desdeY = (y + ZONA_DE_SILENCIO) * PIXELES_POR_MODULO;

      for (let py = 0; py < PIXELES_POR_MODULO; py++) {
        for (let px = 0; px < PIXELES_POR_MODULO; px++) {
          const i = ((desdeY + py) * pixeles + (desdeX + px)) * 4;
          datos[i] = 0;
          datos[i + 1] = 0;
          datos[i + 2] = 0;
        }
      }
    }
  }

  return { datos, ancho: pixeles, alto: pixeles };
}

/** Lee un QR de un bitmap. Devuelve `null` si no encuentra ninguno. */
export function leerQr(datos: Uint8ClampedArray, ancho: number, alto: number): string | null {
  return jsQR(datos, ancho, alto)?.data ?? null;
}

/**
 * Arma el QR y **verifica que se lea**. Si no, no devuelve nada: revienta.
 *
 * Preferimos que falle la generación del PDF a que salga un PDF con un código
 * que no funciona.
 */
export async function qrVerificado(url: string): Promise<{ modulos: boolean[][] }> {
  const modulos = await matrizDelQr(url);
  const { datos, ancho, alto } = aBitmap(modulos);
  const leido = leerQr(datos, ancho, alto);

  if (leido !== url) {
    throw new Error(
      `El código QR generado no se pudo leer correctamente. Se esperaba «${url}» y se leyó «${leido ?? "nada"}». No se genera el material impreso.`,
    );
  }

  return { modulos };
}
